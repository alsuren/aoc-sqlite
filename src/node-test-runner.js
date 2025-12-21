#!/usr/bin/env bun

/**
 * Bun SQL test runner that mimics the browser's progressive execution
 * Usage: bun src/node-test-runner.js <sql-file> <input-file>
 */

import { Database } from 'bun:sqlite';
import fs from 'fs';

/**
 * Format SQLite error with context
 * @param {Error} error - The error object from SQLite
 * @param {string} sql - The SQL that caused the error
 * @returns {string} - Formatted error message
 */
function formatSQLError(error, sql) {
    let errorMsg = error.message || 'Unknown SQL error';
    
    // Build a detailed error message
    let detailedError = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    detailedError += `SQL ERROR: ${errorMsg}\n`;
    detailedError += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Show the SQL for context
    const lines = sql.split('\n');
    if (lines.length <= 25) {
        // For short SQL, show the whole thing with line numbers
        detailedError += 'Your SQL:\n';
        lines.forEach((line, idx) => {
            const lineNum = idx + 1;
            detailedError += `${lineNum.toString().padStart(4, ' ')} | ${line}\n`;
        });
    } else {
        // For long SQL, just show it was long
        detailedError += `Your SQL contains ${lines.length} lines (too long to display here)\n`;
        detailedError += 'Try checking your SQL syntax carefully.\n';
    }
    
    return detailedError;
}

const sqlFile = process.argv[2];
const inputFile = process.argv[3];

if (!sqlFile || !inputFile) {
    console.error('Usage: bun src/node-test-runner.js <sql-file> <input-file>');
    process.exit(1);
}

try {
    // Read SQL file
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Create in-memory database
    const db = new Database(':memory:');

    // Always create and populate input_data table from the input file
    db.run('CREATE TABLE IF NOT EXISTS input_data(line TEXT)');

    if (fs.existsSync(inputFile)) {
        const inputData = fs.readFileSync(inputFile, 'utf8');
        const lines = inputData.split('\n').filter(line => line.length > 0);

        const stmt = db.prepare('INSERT INTO input_data (line) VALUES (?)');
        for (const line of lines) {
            stmt.run(line);
        }
    }

    // Create output table where solutions must insert their results
    db.run('CREATE TABLE IF NOT EXISTS output (progress REAL, result TEXT)');

    // Determine debug log filename based on input file
    const logFile = inputFile.replace(/\.txt$/, '.log');
    const logEntries = [];

    // Execute SQL repeatedly until progress reaches 1.0
    let maxIterations = 100; // Safety limit
    let iteration = 0;
    let progress = 0;
    let result = null;

    while (progress < 1.0 && iteration < maxIterations) {
        iteration++;
        // Clear log entries for next iteration
        logEntries.length = 0;

        // Execute all SQL statements in the file
        db.run(sql);

        // Check for debug rows (progress < 1.0)
        const debugRows = db.prepare('SELECT progress, result FROM output').all();
        for (const row of debugRows) {
            logEntries.push(`${row.progress}: ${row.result}`);
        }

        // Check for final result (row with greatest progress)
        const finalRow = db.prepare('SELECT progress, result FROM output ORDER BY progress = 1 desc, progress DESC LIMIT 1').get();

        if (!finalRow && debugRows.length === 0) {
            console.error('Error: SQL did not insert into output table with progress and result columns');
            process.exit(1);
        }

        if (finalRow) {
            progress = finalRow.progress;
            result = finalRow.result;
        }

        // If not complete, continue loop
        if (progress < 1.0) {
            continue;
        }
    }

    if (iteration >= maxIterations) {
        console.error('Error: Maximum iterations reached without completion');
        process.exit(1);
    }

    // Write debug log if there were any debug entries
    if (logEntries.length > 0) {
        const contents = logEntries.join('\n') + '\n'
        if (!fs.existsSync(logFile) || fs.readFileSync(logFile) !== contents) {
            fs.writeFileSync(logFile, contents);
        }
    }

    // Output the final result
    console.log(result);

    db.close();
} catch (error) {
    console.error(formatSQLError(error, fs.readFileSync(sqlFile, 'utf8')));
    process.exit(1);
}
