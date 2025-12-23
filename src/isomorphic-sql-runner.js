/**
 * Isomorphic SQLite runner - shared logic between browser and Bun
 * 
 * This module provides environment-agnostic utilities for:
 * - Error formatting with line/column pointing
 * - Progress loop execution
 * - Output table parsing
 */

/**
 * Format SQLite error with context and line/column pointers
 * @param {Error} error - The error object from SQLite
 * @param {string} sql - The full SQL that was executed
 * @param {Object} options - Environment-specific options
 * @param {function} options.getErrorOffset - Function to get byte offset from error/db
 * @param {Array<string>} options.executedStatements - Statements that succeeded before error
 * @returns {string} - Formatted error message with context
 */
export function formatSQLError(error, sql, options = {}) {
    const { getErrorOffset, executedStatements = [] } = options;

    let errorMsg = error.message || 'Unknown SQL error';

    // Try to get error offset
    let errorOffset = -1;
    if (getErrorOffset) {
        try {
            errorOffset = getErrorOffset(error);
        } catch (e) {
            // Ignore if not available
        }
    }

    // Determine which statement failed
    let failingStatement;
    let statementNumber;
    let statementStartOffset = 0;

    if (executedStatements.length > 0) {
        // Some statements prepared successfully, error is in the next one
        let consumedBytes = 0;
        for (const stmt of executedStatements) {
            const remainingSQL = sql.substring(consumedBytes);
            const stmtIndex = remainingSQL.indexOf(stmt);
            if (stmtIndex !== -1) {
                consumedBytes += stmtIndex + stmt.length;
            }
        }

        const remainingSQL = sql.substring(consumedBytes);
        const trimmedStart = remainingSQL.match(/^[\s;]*/)[0].length;

        statementStartOffset = consumedBytes;
        failingStatement = remainingSQL.substring(trimmedStart);
        statementNumber = executedStatements.length + 1;
    } else {
        failingStatement = sql;
        statementStartOffset = 0;
        statementNumber = 0;
    }

    const allLines = sql.split('\n');

    // Convert byte offset to line and column in the ORIGINAL SQL
    let errorLine = -1;
    let errorColumn = -1;
    if (errorOffset >= 0) {
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

    // Show the SQL with context
    if (allLines.length <= 25) {
        // For short SQL, show the whole thing with line numbers
        detailedError += statementNumber > 0
            ? `Failing statement:\n`
            : 'Your SQL:\n';
        allLines.forEach((line, idx) => {
            const lineNum = idx + 1;
            detailedError += `${lineNum.toString().padStart(4, ' ')} | ${line}\n`;

            // Add pointer to error column if this is the error line
            if (lineNum === errorLine && errorColumn > 0) {
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
            const startLine = Math.max(0, errorLine - 4);
            const endLine = Math.min(errorLine + 2, allLines.length);

            if (startLine > 0) {
                detailedError += `\n... (${startLine} lines before)\n\n`;
            }

            for (let i = startLine; i < endLine; i++) {
                const lineNum = i + 1;
                detailedError += `${lineNum.toString().padStart(4, ' ')} | ${allLines[i]}\n`;

                if (lineNum === errorLine && errorColumn > 0) {
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
 * Parse output rows to extract progress and result
 * @param {Array<{progress: number, result: string}>} rows - Rows from output table
 * @returns {{progress: number, result: string|null, debugRows: Array}} - Parsed result
 */
export function parseOutputRows(rows) {
    if (!rows || rows.length === 0) {
        return { progress: 0, result: null, debugRows: [] };
    }

    // Find debug rows (progress < 1.0) and final result (progress = 1.0)
    const debugRows = rows.filter(row => row.progress < 1.0);
    const finalRow = rows.find(row => row.progress >= 1.0);

    if (finalRow) {
        return {
            progress: finalRow.progress,
            result: finalRow.result,
            debugRows
        };
    }

    // No final result, return highest progress from debug rows
    let maxProgress = 0;
    let maxResult = null;
    for (const row of debugRows) {
        if (row.progress > maxProgress) {
            maxProgress = row.progress;
            maxResult = row.result;
        }
    }

    return {
        progress: maxProgress,
        result: maxResult,
        debugRows
    };
}

/**
 * Run progress loop until completion or max iterations
 * @param {function} executeOnce - Async function that executes SQL once and returns {success, progress, result, error, debugRows}
 * @param {Object} options - Loop options
 * @param {number} options.maxIterations - Maximum iterations (default 1000)
 * @param {function} options.onProgress - Callback for progress updates
 * @param {function} options.onDebug - Callback for debug rows
 * @param {function} options.shouldStop - Function that returns true to stop early
 * @param {function} options.waitFrame - Async function to wait between iterations (e.g., requestAnimationFrame)
 * @returns {Promise<{success: boolean, progress: number, result: string|null, error?: string, iterations: number}>}
 */
export async function runProgressLoop(executeOnce, options = {}) {
    const {
        maxIterations = 1000,
        onProgress,
        onDebug,
        shouldStop,
        waitFrame
    } = options;

    let iterations = 0;
    let lastProgress = 0;
    let lastResult = null;

    while (iterations < maxIterations) {
        // Check for early stop
        if (shouldStop && shouldStop()) {
            return {
                success: false,
                progress: lastProgress,
                result: lastResult,
                error: 'Stopped by user',
                iterations
            };
        }

        iterations++;

        const result = await executeOnce();

        if (!result.success) {
            return {
                success: false,
                progress: lastProgress,
                result: lastResult,
                error: result.error,
                iterations
            };
        }

        // Report debug rows
        if (onDebug && result.debugRows && result.debugRows.length > 0) {
            onDebug(result.debugRows);
        }

        // Report progress
        if (onProgress && result.progress !== undefined) {
            onProgress(result.progress, result.result);
        }

        lastProgress = result.progress ?? lastProgress;
        lastResult = result.result ?? lastResult;

        // Check for completion
        if (result.progress >= 1.0) {
            return {
                success: true,
                progress: result.progress,
                result: result.result,
                iterations
            };
        }

        // Wait before next iteration if provided
        if (waitFrame) {
            await waitFrame();
        }
    }

    return {
        success: false,
        progress: lastProgress,
        result: lastResult,
        error: 'Maximum iterations reached without completion',
        iterations
    };
}

/**
 * Generate SQL to create and populate input_data table
 * @param {string[]} lines - Input lines
 * @returns {string} - SQL statements
 */
export function createInputTableSQL(lines) {
    let sql = 'CREATE TABLE IF NOT EXISTS input_data(line TEXT);\n';
    sql += 'DELETE FROM input_data;\n';

    for (const line of lines) {
        const escapedLine = line.replace(/'/g, "''");
        sql += `INSERT INTO input_data (line) VALUES ('${escapedLine}');\n`;
    }

    return sql;
}

/**
 * Generate SQL to create output table
 * @returns {string} - SQL statement
 */
export function createOutputTableSQL() {
    return `
        CREATE TABLE IF NOT EXISTS output (progress REAL, result TEXT);
        DELETE FROM output;
    `;
}
