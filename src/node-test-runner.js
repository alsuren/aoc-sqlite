#!/usr/bin/env node

/**
 * Node.js SQL test runner that mimics the browser's progressive execution
 * Usage: node src/node-test-runner.js <sql-file> <input-file>
 */

import Database from 'better-sqlite3';
import fs from 'fs';

const sqlFile = process.argv[2];
const inputFile = process.argv[3];

if (!sqlFile || !inputFile) {
    console.error('Usage: node src/node-test-runner.js <sql-file> <input-file>');
    process.exit(1);
}

try {
    // Read SQL file
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Create in-memory database
    const db = new Database(':memory:');

    // Always create and populate input_data table from the input file
    db.exec('CREATE TABLE IF NOT EXISTS input_data(line TEXT)');

    if (fs.existsSync(inputFile)) {
        const inputData = fs.readFileSync(inputFile, 'utf8');
        const lines = inputData.split('\n').filter(line => line.length > 0);

        const stmt = db.prepare('INSERT INTO input_data (line) VALUES (?)');
        for (const line of lines) {
            stmt.run(line);
        }
    }

    // Execute SQL repeatedly until progress reaches 1.0
    let maxIterations = 100; // Safety limit
    let iteration = 0;
    let progress = 0;
    let result = null;

    while (progress < 1.0 && iteration < maxIterations) {
        iteration++;

        // Execute the SQL (may have multiple statements)
        db.exec(sql);

        // Parse SQL to find the last SELECT statement
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        const lastSelect = statements[statements.length - 1];

        // Remove leading comments from the statement
        const lines = lastSelect.split('\n');
        const codeLines = lines.filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith('--');
        });
        const cleanedSelect = codeLines.join('\n');

        if (!cleanedSelect || !cleanedSelect.trim().toUpperCase().startsWith('SELECT')) {
            console.error('Error: Last statement is not a SELECT');
            console.error('Last statement:', cleanedSelect);
            process.exit(1);
        }

        const row = db.prepare(cleanedSelect).get();

        if (!row || typeof row.progress === 'undefined') {
            console.error('Error: SQL did not return progress and result columns');
            process.exit(1);
        }

        progress = row.progress;
        result = row.result;

        // If not complete, continue loop
        if (progress < 1.0) {
            continue;
        }
    }

    if (iteration >= maxIterations) {
        console.error('Error: Maximum iterations reached without completion');
        process.exit(1);
    }

    // Output the final result
    console.log(result);

    db.close();
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
