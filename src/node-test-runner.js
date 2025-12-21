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
        // For long SQL, show surrounding lines to give context
        // Try to extract line number from error message if available
        const lineMatch = errorMsg.match(/line (\d+)/i);
        let errorLine = lineMatch ? parseInt(lineMatch[1], 10) - 1 : -1;
        
        // If we couldn't find the line number, show first and last few lines
        if (errorLine < 0 || errorLine >= lines.length) {
            detailedError += `Your SQL contains ${lines.length} lines. Showing first and last 5 lines:\n\n`;
            detailedError += 'First 5 lines:\n';
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                detailedError += `${(i + 1).toString().padStart(4, ' ')} | ${lines[i]}\n`;
            }
            if (lines.length > 10) {
                detailedError += `     | ... (${lines.length - 10} lines omitted) ...\n`;
            }
            if (lines.length > 5) {
                detailedError += '\nLast 5 lines:\n';
                for (let i = Math.max(0, lines.length - 5); i < lines.length; i++) {
                    detailedError += `${(i + 1).toString().padStart(4, ' ')} | ${lines[i]}\n`;
                }
            }
        } else {
            // Show 5 lines before and after the error line
            detailedError += `Your SQL contains ${lines.length} lines. Showing context around line ${errorLine + 1}:\n\n`;
            const start = Math.max(0, errorLine - 5);
            const end = Math.min(lines.length, errorLine + 6);
            for (let i = start; i < end; i++) {
                const lineNum = i + 1;
                const marker = i === errorLine ? '→' : ' ';
                detailedError += `${marker}${lineNum.toString().padStart(4, ' ')} | ${lines[i]}\n`;
            }
        }
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
