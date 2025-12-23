/**
 * Unit tests for bun-sql-runner.js
 * Run with: bun test
 * 
 * Note: The sqlite-wasm module can only be initialized once per process,
 * so we use a single initialization for all tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { initSQLite, executeSQL, loadInputData, getDB, closeDB } from './bun-sql-runner.js';

describe('bun-sql-runner', () => {
    beforeAll(async () => {
        const result = await initSQLite();
        expect(result.success).toBe(true);
    });

    afterAll(() => {
        closeDB();
    });

    describe('initSQLite', () => {
        it('initializes successfully', async () => {
            // Already initialized in beforeAll
            expect(getDB()).toBeDefined();
        });
    });

    describe('loadInputData', () => {
        it('loads input lines into input_data table', () => {
            loadInputData(['line1', 'line2', 'line3']);

            const db = getDB();
            const rows = [];
            db.exec({
                sql: 'SELECT line FROM input_data ORDER BY rowid',
                rowMode: 'object',
                resultRows: rows
            });

            expect(rows).toHaveLength(3);
            expect(rows[0].line).toBe('line1');
            expect(rows[1].line).toBe('line2');
            expect(rows[2].line).toBe('line3');
        });

        it('handles lines with single quotes', () => {
            loadInputData(["it's a test"]);

            const db = getDB();
            const rows = [];
            db.exec({
                sql: 'SELECT line FROM input_data',
                rowMode: 'object',
                resultRows: rows
            });

            expect(rows[0].line).toBe("it's a test");
        });

        it('clears previous data on each load', () => {
            loadInputData(['old1', 'old2']);
            loadInputData(['new1']);

            const db = getDB();
            const rows = [];
            db.exec({
                sql: 'SELECT line FROM input_data',
                rowMode: 'object',
                resultRows: rows
            });

            expect(rows).toHaveLength(1);
            expect(rows[0].line).toBe('new1');
        });
    });

    describe('executeSQL', () => {
        it('executes simple SQL and returns progress/result', () => {
            const sql = "INSERT INTO output (progress, result) VALUES (1.0, '42')";

            const result = executeSQL(sql);

            expect(result.success).toBe(true);
            expect(result.progress).toBe(1.0);
            expect(result.result).toBe('42');
        });

        it('returns error for missing output', () => {
            const sql = "SELECT 1 + 1";

            const result = executeSQL(sql);

            expect(result.success).toBe(false);
            expect(result.error).toContain('output table');
        });

        it('returns error for syntax errors', () => {
            const sql = "SELEC * FROM foo";

            const result = executeSQL(sql);

            expect(result.success).toBe(false);
            expect(result.error).toContain('SQL ERROR');
        });

        it('handles debug rows (progress < 1.0)', () => {
            const sql = `
                INSERT INTO output (progress, result) VALUES (0.5, 'partial');
                INSERT INTO output (progress, result) VALUES (1.0, 'final');
            `;

            const result = executeSQL(sql);

            expect(result.success).toBe(true);
            expect(result.progress).toBe(1.0);
            expect(result.result).toBe('final');
            expect(result.debugRows).toHaveLength(1);
            expect(result.debugRows[0].result).toBe('partial');
        });

        it('can read from input_data table', () => {
            loadInputData(['hello', 'world']);

            const sql = `
                INSERT INTO output (progress, result)
                SELECT 1.0, group_concat(line, ' ')
                FROM input_data;
            `;

            const result = executeSQL(sql);

            expect(result.success).toBe(true);
            expect(result.result).toBe('hello world');
        });

        it('clears output table between executions', () => {
            executeSQL("INSERT INTO output (progress, result) VALUES (0.5, 'first')");
            const result = executeSQL("INSERT INTO output (progress, result) VALUES (1.0, 'second')");

            expect(result.progress).toBe(1.0);
            expect(result.result).toBe('second');
            expect(result.debugRows).toHaveLength(0); // No stale debug rows from first execution
        });
    });
});
