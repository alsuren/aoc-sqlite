// SQLite WASM runner with OPFS persistence and in-memory fallback
// Exposes methods to initialize SQLite and execute SQL

let db = null;
let sqlite3 = null;

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
 * Create the results table
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
        )
    `);
}

/**
 * Execute SQL and return results
 * @param {string} sql - SQL statements to execute
 * @returns {Promise<{success: boolean, rows?: Array, error?: string, lastRow?: Object}>}
 */
export async function executeSQL(sql) {
    if (!db) {
        return { success: false, error: 'Database not initialized' };
    }

    try {
        let lastRow = null;
        const rows = [];

        // Execute the SQL
        db.exec({
            sql: sql,
            rowMode: 'object',
            resultRows: rows,
            callback: (row) => {
                lastRow = row;
            }
        });

        return {
            success: true,
            rows: rows,
            lastRow: lastRow || (rows.length > 0 ? rows[rows.length - 1] : null)
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
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
