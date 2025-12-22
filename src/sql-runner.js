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
 * Format SQLite error with context
 * @param {Error} error - The error object from SQLite
 * @param {string} sql - The full SQL that was passed to exec()
 * @param {Array<string>} executedStatements - Array of statements that were prepared before the error
 * @returns {string} - Formatted error message
 */
function formatSQLError(error, sql, executedStatements = []) {
    let errorMsg = error.message || 'Unknown SQL error';

    // Try to get error offset from SQLite if available
    // sqlite3_error_offset() returns byte offset within the failing statement
    let errorOffset = -1;
    try {
        if (db && sqlite3 && sqlite3.capi && sqlite3.capi.sqlite3_error_offset) {
            errorOffset = sqlite3.capi.sqlite3_error_offset(db.pointer);
        }
    } catch (e) {
        // Ignore if not available
    }

    // Determine which statement failed and what type of error occurred
    // - Syntax errors during prepare: failing statement is NOT in saveSql yet  
    // - Semantic errors during prepare (like "no such table"): also NOT in saveSql yet
    // - Runtime errors during step: failing statement IS in saveSql
    // 
    // In practice, most errors happen during prepare (both syntax and semantic).
    // If we have N statements in saveSql, the error is in statement #(N+1).
    // If saveSql is empty, the error is in statement #1 (or the entire SQL if single statement).

    let failingStatement;
    let statementNumber;
    let statementStartOffset = 0; // Track where the failing statement starts in the original SQL

    if (executedStatements.length > 0) {
        // Some statements prepared successfully, error is in the next one
        // Calculate where in the original SQL the failing statement starts
        // by finding where the successfully executed statements are located
        let consumedBytes = 0;
        for (const stmt of executedStatements) {
            // Find this statement in the remaining SQL
            const remainingSQL = sql.substring(consumedBytes);
            const stmtIndex = remainingSQL.indexOf(stmt);
            if (stmtIndex !== -1) {
                // Move past this statement (including any whitespace/semicolons after it)
                consumedBytes += stmtIndex + stmt.length;
            }
        }
        
        // The failing statement starts where we left off, but we need to skip
        // past any whitespace/semicolons that come after the last executed statement
        const remainingSQL = sql.substring(consumedBytes);
        const trimmedStart = remainingSQL.match(/^[\s;]*/)[0].length;
        
        // statementStartOffset is where SQLite started parsing (including whitespace)
        // because errorOffset from SQLite is relative to the start of the remaining SQL
        statementStartOffset = consumedBytes;
        failingStatement = remainingSQL.substring(trimmedStart);
        statementNumber = executedStatements.length + 1;
    } else {
        // No statements were successfully prepared (error in first statement)
        failingStatement = sql;
        statementStartOffset = 0;
        statementNumber = 0; // Don't show statement number for first statement errors
    }

    // Work with the original SQL to get correct line numbers
    const allLines = sql.split('\n');
    const lines = failingStatement.split('\n');

    // Convert byte offset (within failing statement) to line and column in the ORIGINAL SQL
    let errorLine = -1;
    let errorColumn = -1;
    if (errorOffset >= 0) {
        // errorOffset is relative to the failing statement, so add statementStartOffset
        const absoluteErrorOffset = statementStartOffset + errorOffset;
        
        let currentOffset = 0;
        for (let i = 0; i < allLines.length; i++) {
            const lineLength = allLines[i].length + 1; // +1 for newline
            if (currentOffset + lineLength > absoluteErrorOffset) {
                errorLine = i + 1; // 1-indexed
                errorColumn = absoluteErrorOffset - currentOffset + 1; // 1-indexed
                break;
            }
            currentOffset += lineLength;
        }
    }

    // Build a detailed error message
    let detailedError = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    detailedError += `SQL ERROR: ${errorMsg}\n`;
    if (statementNumber > 0) {
        detailedError += `Failed at statement #${statementNumber}\n`;
    }
    if (errorLine > 0) {
        detailedError += `Location: Line ${errorLine}, Column ${errorColumn}\n`;
    }
    detailedError += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Show the failing statement
    if (allLines.length <= 25) {
        // For short SQL, show the whole thing with line numbers
        detailedError += statementNumber > 0
            ? `Failing statement:\n`
            : 'Your SQL:\n';
        allLines.forEach((line, idx) => {
            const lineNum = idx + 1;
            const isErrorLine = lineNum === errorLine;
            detailedError += `${lineNum.toString().padStart(4, ' ')} | ${line}\n`;

            // Add pointer to error column if this is the error line
            if (isErrorLine && errorColumn > 0) {
                detailedError += `     | ${' '.repeat(errorColumn - 1)}^\n`;
            }
        });
    } else {
        // For long SQL, show context around the error
        detailedError += statementNumber > 0
            ? `Failing statement (showing error context in full file):\n`
            : 'Your SQL (showing error context):\n';
        
        if (errorLine > 0) {
            // Show from 3 lines before to 2 lines after the error
            const startLine = Math.max(0, errorLine - 4); // -4 because errorLine is 1-indexed
            const endLine = Math.min(errorLine + 2, allLines.length);
            
            if (startLine > 0) {
                detailedError += `\n... (${startLine} lines before)\n\n`;
            }
            
            for (let i = startLine; i < endLine; i++) {
                const lineNum = i + 1;
                const isErrorLine = lineNum === errorLine;
                detailedError += `${lineNum.toString().padStart(4, ' ')} | ${allLines[i]}\n`;
                
                // Add pointer to error column if this is the error line
                if (isErrorLine && errorColumn > 0) {
                    detailedError += `     | ${' '.repeat(errorColumn - 1)}^\n`;
                }
            }
            
            if (endLine < allLines.length) {
                detailedError += `\n... (${allLines.length - endLine} more lines)\n`;
            }
        } else {
            // No error location, just show first few lines
            detailedError += `The SQL contains ${allLines.length} lines.\n`;
            detailedError += `Showing first 10 lines:\n\n`;
            for (let i = 0; i < Math.min(10, allLines.length); i++) {
                detailedError += `${(i + 1).toString().padStart(4, ' ')} | ${allLines[i]}\n`;
            }
            if (allLines.length > 10) {
                detailedError += `\n... (${allLines.length - 10} more lines)\n`;
            }
        }
    }

    return detailedError;
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
