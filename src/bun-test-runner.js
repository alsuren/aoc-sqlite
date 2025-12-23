#!/usr/bin/env bun

/**
 * Bun SQL test runner that mimics the browser's progressive execution
 * Usage: bun src/bun-test-runner.js <sql-file> <input-file>
 */

import fs from 'fs';
import { initSQLite, executeSQL, loadInputData, closeDB } from './bun-sql-runner.js';
import { runProgressLoop } from './isomorphic-sql-runner.js';

const sqlFile = process.argv[2];
const inputFile = process.argv[3];

if (!sqlFile || !inputFile) {
    console.error('Usage: bun src/bun-test-runner.js <sql-file> <input-file>');
    process.exit(1);
}

async function main() {
    try {
        // Initialize SQLite
        const initResult = await initSQLite();
        if (!initResult.success) {
            console.error('Failed to initialize SQLite:', initResult.error);
            process.exit(1);
        }

        // Read SQL file
        const sql = fs.readFileSync(sqlFile, 'utf8');

        // Load input data if file exists
        if (fs.existsSync(inputFile)) {
            const inputData = fs.readFileSync(inputFile, 'utf8');
            const lines = inputData.split('\n').filter(line => line.length > 0);
            loadInputData(lines);
        }

        // Determine debug log filename based on input file
        const logFile = inputFile.replace(/\.txt$/, '.log');
        const logEntries = [];

        // Run the progress loop
        const result = await runProgressLoop(
            () => executeSQL(sql),
            {
                maxIterations: 100,
                onDebug: (debugRows) => {
                    for (const row of debugRows) {
                        logEntries.push(`${row.progress}: ${row.result}`);
                    }
                }
            }
        );

        if (!result.success) {
            console.error(result.error);
            process.exit(1);
        }

        // Write debug log if there were any debug entries
        if (logEntries.length > 0) {
            const contents = logEntries.join('\n') + '\n';
            if (!fs.existsSync(logFile) || fs.readFileSync(logFile, 'utf8') !== contents) {
                fs.writeFileSync(logFile, contents);
            }
        }

        // Output the final result
        console.log(result.result);

        closeDB();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
