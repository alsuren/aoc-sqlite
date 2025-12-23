/**
 * Bun SQLite runner adapter
 * Uses @sqlite.org/sqlite-wasm for true isomorphism with browser
 * 
 * Note: This uses the WASM build even in Bun for identical SQL behavior.
 * If you need native performance, you could swap to bun:sqlite but may
 * encounter subtle differences in SQL dialect or error handling.
 */

// Use relative path - this works in Bun but not Node.js
// (Bun resolves node_modules relative to the file, Node.js does not)
import sqlite3InitModule from '../node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.mjs';
import { formatSQLError, parseOutputRows, createOutputTableSQL } from './isomorphic-sql-runner.js';

let db = null;
let sqlite3 = null;

/**
 * Initialize SQLite WASM (in-memory only for CLI)
 * @returns {Promise<{success: boolean, mode: string, error?: string}>}
 */
export async function initSQLite() {
    try {
        sqlite3 = await sqlite3InitModule();
        db = new sqlite3.oo1.DB(':memory:');

        // Create output table
        db.exec(createOutputTableSQL());

        // Create input_data table
        db.exec('CREATE TABLE IF NOT EXISTS input_data(line TEXT)');

        return { success: true, mode: 'memory' };
    } catch (error) {
        return { success: false, mode: 'none', error: error.message };
    }
}

/**
 * Get error offset from SQLite error
 * @param {Error} error - The error (unused, offset comes from db)
 * @returns {number} - Byte offset or -1
 */
function getErrorOffset(error) {
    if (db && sqlite3 && sqlite3.capi && sqlite3.capi.sqlite3_error_offset) {
        return sqlite3.capi.sqlite3_error_offset(db.pointer);
    }
    return -1;
}

/**
 * Load input data into the input_data table
 * @param {string[]} lines - Array of input lines
 */
export function loadInputData(lines) {
    if (!db) {
        throw new Error('Database not initialized');
    }

    db.exec('DELETE FROM input_data');

    for (const line of lines) {
        const escapedLine = line.replace(/'/g, "''");
        db.exec(`INSERT INTO input_data (line) VALUES ('${escapedLine}')`);
    }
}

/**
 * Execute SQL and return results from output table
 * @param {string} sql - SQL statements to execute
 * @returns {{success: boolean, error?: string, progress?: number, result?: string, debugRows?: Array}}
 */
export function executeSQL(sql) {
    if (!db) {
        return { success: false, error: 'Database not initialized' };
    }

    const executedStatements = [];
    try {
        // Clear output table before execution
        db.exec('DELETE FROM output');

        // Execute the SQL statements
        db.exec({
            sql: sql,
            saveSql: executedStatements
        });

        // Get all rows from output table
        const outputRows = [];
        db.exec({
            sql: 'SELECT progress, result FROM output ORDER BY progress DESC',
            rowMode: 'object',
            resultRows: outputRows
        });

        if (outputRows.length === 0) {
            return {
                success: false,
                error: 'SQL did not insert into output table with progress and result columns'
            };
        }

        const parsed = parseOutputRows(outputRows);

        return {
            success: true,
            progress: parsed.progress,
            result: parsed.result,
            debugRows: parsed.debugRows
        };
    } catch (error) {
        return {
            success: false,
            error: formatSQLError(error, sql, {
                getErrorOffset: () => getErrorOffset(error),
                executedStatements
            })
        };
    }
}

/**
 * Get the database instance (for direct access if needed)
 * @returns {Object|null}
 */
export function getDB() {
    return db;
}

/**
 * Close the database
 */
export function closeDB() {
    if (db) {
        db.close();
        db = null;
    }
}
