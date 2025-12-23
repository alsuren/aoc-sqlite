/**
 * Unit tests for isomorphic-sql-runner.js
 * Run with: bun test
 */

import { describe, it, expect } from 'bun:test';
import {
    formatSQLError,
    parseOutputRows,
    runProgressLoop,
    createInputTableSQL,
    createOutputTableSQL
} from './isomorphic-sql-runner.js';

describe('formatSQLError', () => {
    it('formats basic error message', () => {
        const error = new Error('syntax error near "SELEC"');
        const sql = 'SELEC * FROM table';

        const result = formatSQLError(error, sql);

        expect(result).toContain('SQL ERROR');
        expect(result).toContain('syntax error near "SELEC"');
        expect(result).toContain('SELEC * FROM table');
    });

    it('shows line numbers for short SQL', () => {
        const error = new Error('no such table: foo');
        const sql = 'SELECT * FROM foo;\nSELECT * FROM bar;';

        const result = formatSQLError(error, sql);

        expect(result).toContain('   1 |');
        expect(result).toContain('   2 |');
    });

    it('handles error offset when provided', () => {
        const error = new Error('syntax error');
        const sql = 'SELECT * FROM\nfoo WHERE bad';

        const result = formatSQLError(error, sql, {
            getErrorOffset: () => 18, // Points to "bad"
            executedStatements: []
        });

        expect(result).toContain('Line 2');
    });

    it('handles multiple executed statements', () => {
        const error = new Error('syntax error');
        const sql = 'SELECT 1; SELECT 2; SELEC 3';

        const result = formatSQLError(error, sql, {
            executedStatements: ['SELECT 1', 'SELECT 2']
        });

        expect(result).toContain('statement #3');
    });
});

describe('parseOutputRows', () => {
    it('returns empty result for empty rows', () => {
        const result = parseOutputRows([]);

        expect(result.progress).toBe(0);
        expect(result.result).toBeNull();
        expect(result.debugRows).toEqual([]);
    });

    it('extracts final result when progress is 1.0', () => {
        const rows = [
            { progress: 0.5, result: 'partial' },
            { progress: 1.0, result: 'final' }
        ];

        const result = parseOutputRows(rows);

        expect(result.progress).toBe(1.0);
        expect(result.result).toBe('final');
        expect(result.debugRows).toHaveLength(1);
        expect(result.debugRows[0].result).toBe('partial');
    });

    it('returns highest progress when no final result', () => {
        const rows = [
            { progress: 0.3, result: 'low' },
            { progress: 0.7, result: 'high' },
            { progress: 0.5, result: 'mid' }
        ];

        const result = parseOutputRows(rows);

        expect(result.progress).toBe(0.7);
        expect(result.result).toBe('high');
    });
});

describe('runProgressLoop', () => {
    it('completes when progress reaches 1.0', async () => {
        let iteration = 0;
        const executeOnce = async () => {
            iteration++;
            if (iteration < 3) {
                return { success: true, progress: iteration * 0.3, result: `step ${iteration}` };
            }
            return { success: true, progress: 1.0, result: 'done' };
        };

        const result = await runProgressLoop(executeOnce);

        expect(result.success).toBe(true);
        expect(result.progress).toBe(1.0);
        expect(result.result).toBe('done');
        expect(result.iterations).toBe(3);
    });

    it('stops on error', async () => {
        let iteration = 0;
        const executeOnce = async () => {
            iteration++;
            if (iteration === 2) {
                return { success: false, error: 'SQL error' };
            }
            return { success: true, progress: 0.5, result: 'partial' };
        };

        const result = await runProgressLoop(executeOnce);

        expect(result.success).toBe(false);
        expect(result.error).toBe('SQL error');
        expect(result.iterations).toBe(2);
    });

    it('respects maxIterations', async () => {
        const executeOnce = async () => {
            return { success: true, progress: 0.5, result: 'stuck' };
        };

        const result = await runProgressLoop(executeOnce, { maxIterations: 5 });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Maximum iterations');
        expect(result.iterations).toBe(5);
    });

    it('calls onProgress callback', async () => {
        const progressUpdates = [];
        const executeOnce = async () => {
            return { success: true, progress: 1.0, result: 'done' };
        };

        await runProgressLoop(executeOnce, {
            onProgress: (p, r) => progressUpdates.push({ p, r })
        });

        expect(progressUpdates).toHaveLength(1);
        expect(progressUpdates[0]).toEqual({ p: 1.0, r: 'done' });
    });

    it('respects shouldStop callback', async () => {
        let iteration = 0;
        const executeOnce = async () => {
            iteration++;
            return { success: true, progress: 0.5, result: 'running' };
        };

        const result = await runProgressLoop(executeOnce, {
            shouldStop: () => iteration >= 3
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Stopped by user');
        expect(result.iterations).toBe(3);
    });
});

describe('createInputTableSQL', () => {
    it('generates correct SQL for input lines', () => {
        const lines = ['line1', 'line2', 'line3'];

        const sql = createInputTableSQL(lines);

        expect(sql).toContain('CREATE TABLE IF NOT EXISTS input_data');
        expect(sql).toContain('DELETE FROM input_data');
        expect(sql).toContain("INSERT INTO input_data (line) VALUES ('line1')");
        expect(sql).toContain("INSERT INTO input_data (line) VALUES ('line2')");
        expect(sql).toContain("INSERT INTO input_data (line) VALUES ('line3')");
    });

    it('escapes single quotes', () => {
        const lines = ["it's a test"];

        const sql = createInputTableSQL(lines);

        expect(sql).toContain("VALUES ('it''s a test')");
    });
});

describe('createOutputTableSQL', () => {
    it('generates correct SQL', () => {
        const sql = createOutputTableSQL();

        expect(sql).toContain('CREATE TABLE IF NOT EXISTS output');
        expect(sql).toContain('progress REAL');
        expect(sql).toContain('result TEXT');
        expect(sql).toContain('DELETE FROM output');
    });
});
