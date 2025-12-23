// SQLite WASM runner with OPFS persistence and in-memory fallback
// Exposes methods to initialize SQLite and execute SQL

import { formatSQLError as formatSQLErrorIsomorphic, parseOutputRows } from './isomorphic-sql-runner.js';

let db = null;
let sqlite3 = null;

/**
 * Get error offset from SQLite
 * @returns {number} - Byte offset or -1
 */
function getErrorOffset() {
    if (db && sqlite3 && sqlite3.capi && sqlite3.capi.sqlite3_error_offset) {
        return sqlite3.capi.sqlite3_error_offset(db.pointer);
    }
    return -1;
}

/**
 * Format SQLite error with context (browser-specific wrapper)
 * @param {Error} error - The error object from SQLite
 * @param {string} sql - The full SQL that was passed to exec()
 * @param {Array<string>} executedStatements - Array of statements that were prepared before the error
 * @returns {string} - Formatted error message
 */
function formatSQLError(error, sql, executedStatements = []) {
    return formatSQLErrorIsomorphic(error, sql, {
        getErrorOffset: () => getErrorOffset(),
        executedStatements
    });
}

/**
 * Initialize SQLite WASM
 * Attempts OPFS persistence first, falls back to in-memory
 * @returns {Promise<{success: boolean, mode: string, error?: string}>}
 */
export async function initSQLite() {
    try {
        // Wait for sqlite3InitModule to be available and call it
        if (!globalThis.sqlite3InitModule) {
            throw new Error('sqlite3InitModule not found - ensure sqlite3.js is loaded');
        }

        sqlite3 = await globalThis.sqlite3InitModule();

        // Try to initialize with OPFS
        try {
            const oo = await sqlite3.installOpfsSAHPoolVfs({
                name: 'opfs-sahpool'
            });

            db = new sqlite3.oo1.DB('/aoc.db', 'ct', 'opfs-sahpool');
            console.log('SQLite initialized with OPFS persistence');

            // Create results table
            await initResultsTable();

            return { success: true, mode: 'opfs' };
        } catch (opfsError) {
            console.warn('OPFS initialization failed, falling back to in-memory:', opfsError);

            // Fall back to in-memory database
            db = new sqlite3.oo1.DB(':memory:');
            console.log('SQLite initialized with in-memory storage');

            // Create results table
            await initResultsTable();

            return { success: true, mode: 'memory' };
        }
    } catch (error) {
        console.error('SQLite initialization failed:', error);
        return { success: false, mode: 'none', error: error.message };
    }
}

/**
 * Create the required tables
 */
function initResultsTable() {
    if (!db) {
        throw new Error('Database not initialized');
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS results (
            year INTEGER NOT NULL,
            day INTEGER NOT NULL,
            part INTEGER NOT NULL,
            progress REAL NOT NULL,
            result TEXT,
            timestamp INTEGER NOT NULL,
            PRIMARY KEY (year, day, part)
        );
        
        CREATE TABLE IF NOT EXISTS input_data (line TEXT);
        
        CREATE TABLE IF NOT EXISTS output (progress REAL, result TEXT);
        
        CREATE TABLE IF NOT EXISTS progress_counter (run_count INTEGER);
        INSERT INTO progress_counter SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM progress_counter);
    `);
}

/**
 * Execute SQL and return results from output table
 * @param {string} sql - SQL statements to execute (should INSERT INTO output for AoC solutions)
 * @returns {Promise<{success: boolean, error?: string, lastRow?: Object, rows?: Array, debugRows?: Array}>}
 */
export async function executeSQL(sql) {
    if (!db) {
        return { success: false, error: 'Database not initialized' };
    }

    const executedStatements = [];
    try {
        // Execute the SQL statements
        const directRows = [];
        db.exec({
            sql: sql,
            rowMode: 'object',
            resultRows: directRows,
            saveSql: executedStatements
        });

        // Check if we got direct results (for metadata queries like sqlite_master)
        if (directRows.length > 0) {
            return {
                success: true,
                rows: directRows,
                lastRow: directRows[directRows.length - 1]
            };
        }

        // Check for debug rows (progress < 1.0)
        const debugRows = [];
        db.exec({
            sql: 'SELECT progress, result FROM output WHERE progress < 1.0',
            rowMode: 'object',
            resultRows: debugRows
        });

        // Check for final result (progress = 1.0)
        const finalRows = [];
        db.exec({
            sql: 'SELECT progress, result FROM output WHERE progress = 1.0',
            rowMode: 'object',
            resultRows: finalRows
        });

        const lastRow = finalRows.length > 0 ? finalRows[0] : null;

        if (!lastRow && debugRows.length === 0) {
            return {
                success: false,
                error: 'SQL did not insert into output table with progress and result columns'
            };
        }

        // Clear output table for next iteration
        db.exec('DELETE FROM output');

        if (!lastRow) {
            // No final result yet, return debug rows
            return {
                success: true,
                debugRows: debugRows,
                lastRow: null
            };
        }

        return {
            success: true,
            lastRow: lastRow,
            debugRows: debugRows
        };
    } catch (error) {
        return {
            success: false,
            error: formatSQLError(error, sql, executedStatements)
        };
    }
}

/**
 * Get the database instance (for direct access if needed)
 */
export function getDB() {
    return db;
}

/**
 * Close and reset the database
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function resetDatabase() {
    try {
        if (db) {
            db.close();
            db = null;
        }

        // Reinitialize
        return await initSQLite();
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Export database as a Uint8Array (for download)
 * @returns {Uint8Array|null}
 */
export function exportDatabase() {
    if (!db) {
        return null;
    }

    try {
        return sqlite3.capi.sqlite3_js_db_export(db.pointer);
    } catch (error) {
        console.error('Failed to export database:', error);
        return null;
    }
}

/**
 * Save a result to the results table
 * @param {number} year
 * @param {number} day
 * @param {number} part
 * @param {number} progress
 * @param {string} result
 */
export async function saveResult(year, day, part, progress, result) {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const timestamp = Date.now();

    db.exec({
        sql: `
            INSERT OR REPLACE INTO results (year, day, part, progress, result, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
        bind: [year, day, part, progress, result, timestamp]
    });
}

/**
 * Get all completed results
 * @returns {Array}
 */
export function getCompletedResults() {
    if (!db) {
        return [];
    }

    const results = [];
    db.exec({
        sql: 'SELECT year, day, part, progress, result, timestamp FROM results WHERE progress >= 1.0 ORDER BY year, day, part',
        rowMode: 'object',
        callback: (row) => results.push(row)
    });

    return results;
}

// Make functions available globally for testing
if (typeof window !== 'undefined') {
    window.sqlRunner = {
        initSQLite,
        executeSQL,
        getDB,
        resetDatabase,
        exportDatabase,
        saveResult,
        getCompletedResults
    };
}
