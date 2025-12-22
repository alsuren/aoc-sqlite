import { test, expect } from '@playwright/test';

test.describe('SQLite Initialization', () => {
    test('page loads successfully', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('Advent of Code');
    });

    test('SQLite initializes', async ({ page }) => {
        await page.goto('/');

        // Wait for SQLite to initialize
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Check that initialization message appears in output
        const output = page.locator('#output-text');
        await expect(output).toContainText('SQLite initialized');
    });

    test('can execute simple SQL query', async ({ page }) => {
        await page.goto('/');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Execute a simple query (must insert into output table)
        const result = await page.evaluate(async () => {
            return await window.sqlRunner.executeSQL('INSERT INTO output (progress, result) VALUES (1.0, 1 + 1)');
        });

        expect(result.success).toBe(true);
        expect(result.lastRow.result).toBe('2'); // result is TEXT column
    });

    test('results table is created', async ({ page }) => {
        await page.goto('/');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Check that results table exists
        const result = await page.evaluate(async () => {
            return await window.sqlRunner.executeSQL(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='results'"
            );
        });

        expect(result.success).toBe(true);
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].name).toBe('results');
    });
});

test.describe('Navigation', () => {
    test('always renders year selector', async ({ page }) => {
        await page.goto('/');

        const yearSelector = page.locator('#year-selector');
        await expect(yearSelector).toContainText('Select Year');

        // Check for some year links
        await expect(page.locator('.year-link').first()).toBeVisible();
    });

    test('renders day selector when year is in URL', async ({ page }) => {
        await page.goto('/?year=1970&day=1&part=1');

        // Year selector should still be visible
        const yearSelector = page.locator('#year-selector');
        await expect(yearSelector).toContainText('Select Year');

        // Day selector should be visible
        const daySelector = page.locator('#day-selector');
        await expect(daySelector).toContainText('Select Day (1970)');

        // Check for day links
        await expect(page.locator('.day-link').first()).toBeVisible();
    });

    test('renders part selector when year and day are in URL', async ({ page }) => {
        await page.goto('/?year=1970&day=1&part=1');

        // All selectors should be visible
        await expect(page.locator('#year-selector')).toContainText('Select Year');
        await expect(page.locator('#day-selector')).toContainText('Select Day (1970)');

        const partSelector = page.locator('#part-selector');
        await expect(partSelector).toContainText('Select Part (1970-1)');

        // Check for part links
        await expect(page.locator('.part-link').first()).toBeVisible();
    });
});

test.describe('SQL File Execution', () => {
    test('auto-runs and completes test fixture - instant completion', async ({ page }) => {
        await page.goto('/?year=1970&day=1&part=1');

        // Wait for auto-run to complete
        await page.waitForFunction(() => {
            const progressText = document.getElementById('progress-text');
            return progressText && progressText.textContent.includes('100%');
        }, { timeout: 10000 });

        // Check result
        const resultText = await page.locator('#result-text').textContent();
        expect(resultText).toBe('42');

        // Check for completion message
        await expect(page.locator('#output-text')).toContainText('Completed');
    });

    test('auto-runs and handles progressive execution', async ({ page }) => {
        await page.goto('/?year=1970&day=1&part=2');

        // Wait for auto-run to complete (should take 3 iterations)
        await page.waitForFunction(() => {
            const progressText = document.getElementById('progress-text');
            return progressText && progressText.textContent.includes('100%');
        }, { timeout: 5000 });

        // Check result
        const resultText = await page.locator('#result-text').textContent();
        expect(resultText).toBe('completed');
    });

    test('auto-runs day 2 part 1 (input concatenation test)', async ({ page }) => {
        await page.goto('/?year=1970&day=2&part=1');

        // Wait for auto-run to complete
        await page.waitForFunction(() => {
            const progressText = document.getElementById('progress-text');
            return progressText && progressText.textContent.includes('100%');
        }, { timeout: 5000 });

        // Check that result is displayed
        const resultText = await page.locator('#result-text').textContent();
        expect(resultText).toBeTruthy();
        expect(resultText).toContain('hello world'); // Concatenates test input with ' world'
    });

    test('auto-runs and handles missing SQL file', async ({ page }) => {
        await page.goto('/?year=9999&day=99&part=9');

        // Wait for auto-run to fail
        await page.waitForTimeout(2000);

        // Check that error is displayed
        const errorText = await page.locator('#error-text').textContent();
        expect(errorText).toContain('Failed to load');
    });
});

test.describe('SQL Error Formatting', () => {
    test('shows detailed error for syntax error in single statement', async ({ page }) => {
        await page.goto('/');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Execute SQL with syntax error
        const result = await page.evaluate(async () => {
            return await window.sqlRunner.executeSQL('SELECT * FORM output');
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('SQL ERROR');
        expect(result.error).toContain('FORM'); // Error should highlight the problematic keyword
    });

    test('shows statement number for multi-statement SQL error', async ({ page }) => {
        await page.goto('/');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Execute multi-statement SQL where first statement succeeds, 
        // but second statement has a prepare error (happens after first executes)
        const result = await page.evaluate(async () => {
            return await window.sqlRunner.executeSQL(`
                INSERT INTO output (progress, result) VALUES (0.5, 'first statement ok');
                SELECT * FORM output;
                INSERT INTO output (progress, result) VALUES (1.0, 'third statement');
            `);
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('SQL ERROR');
        // The error is in statement #2 (after statement #1 was prepared successfully)
        expect(result.error).toContain('Failed at statement #2');
        expect(result.error).toContain('Failing statement:');
        // Now shows full context with correct line numbers (small file, <= 25 lines)
        expect(result.error).toContain('SELECT * FORM output');
    });

    test('shows line and column numbers for error location', async ({ page }) => {
        await page.goto('/');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Execute multi-line SQL with syntax error
        const result = await page.evaluate(async () => {
            return await window.sqlRunner.executeSQL(`
                INSERT INTO output (progress, result)
                VALUES (1.0, 'test');
                
                SELECT
                    progress,
                    result FORM output
                WHERE progress = 1.0;
            `);
        });

        expect(result.success).toBe(false);
        expect(result.success).toBe(false);
        expect(result.error).toContain('SQL ERROR');
        expect(result.error).toContain('Failed at statement #2');
        expect(result.error).toContain('Location: Line');
        expect(result.error).toContain('Column');
        // Should have a pointer (^) showing error location
        expect(result.error).toContain('^');
    });

    test('handles error in first statement of multi-statement SQL', async ({ page }) => {
        await page.goto('/');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Execute multi-statement SQL with error in first statement
        const result = await page.evaluate(async () => {
            return await window.sqlRunner.executeSQL(`
                SELECT * FORM output;
                INSERT INTO output (progress, result) VALUES (1.0, 'second');
            `);
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('SQL ERROR');
        // When first statement fails, no statement number is shown
        expect(result.error).toContain('Your SQL:');
        expect(result.error).toContain('SELECT * FORM output');
    });

    test('handles table not found error with statement context', async ({ page }) => {
        await page.goto('/');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Execute multi-statement SQL with non-existent table in second statement
        const result = await page.evaluate(async () => {
            return await window.sqlRunner.executeSQL(`
                INSERT INTO output (progress, result) VALUES (0.5, 'ok');
                SELECT * FROM nonexistent_table;
                INSERT INTO output (progress, result) VALUES (1.0, 'done');
            `);
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('SQL ERROR');
        expect(result.error).toContain('Failed at statement #2');
        expect(result.error).toContain('nonexistent_table');
        expect(result.error).toContain('Failing statement:');
    });

    test('error pointer aligns correctly with whitespace between statements', async ({ page }) => {
        await page.goto('/');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Execute multi-statement SQL with whitespace before error
        const result = await page.evaluate(async () => {
            return await window.sqlRunner.executeSQL(`
                INSERT INTO output (progress, result) VALUES (0.5, 'first');

                SELECT * FORM output WHERE progress = 0.5;
            `);
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('SQL ERROR');
        
        // The error should show "FORM" as the problem (syntax error)
        expect(result.error).toContain('FORM');
        
        // Check that we show the location
        expect(result.error).toContain('Location: Line');
        
        // Extract lines to check pointer alignment
        const errorLines = result.error.split('\n');
        
        // Find the line with "SELECT * FORM"
        const formLineIndex = errorLines.findIndex(line => line.includes('SELECT * FORM output'));
        expect(formLineIndex).toBeGreaterThan(-1);
        
        const formLine = errorLines[formLineIndex];
        const pointerLine = errorLines[formLineIndex + 1];
        
        // Should have the pointer
        expect(pointerLine).toContain('^');
        
        // Find positions
        const formPosition = formLine.indexOf('FORM');
        const wherePosition = formLine.indexOf('WHERE');
        const pointerPosition = pointerLine.indexOf('^');
        
        console.log(`Line: "${formLine}"`);
        console.log(`Pointer line: "${pointerLine}"`);
        console.log(`FORM at position ${formPosition}, WHERE at position ${wherePosition}, pointer at position ${pointerPosition}`);
        
        // The pointer should align with FORM (the actual syntax error), not WHERE
        // Allow small margin for line number prefix spacing
        expect(Math.abs(pointerPosition - formPosition)).toBeLessThanOrEqual(2);
    });
});

test.describe('Database Management', () => {
    test('reset button shows confirmation', async ({ page }) => {
        await page.goto('/');

        // Set up dialog handler
        let dialogShown = false;
        page.on('dialog', async dialog => {
            dialogShown = true;
            expect(dialog.message()).toContain('reset');
            await dialog.dismiss();
        });

        await page.click('#reset-db-btn');

        // Wait a bit for dialog
        await page.waitForTimeout(500);
        expect(dialogShown).toBe(true);
    });

    test('download button triggers download', async ({ page }) => {
        await page.goto('/');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Set up download handler
        const downloadPromise = page.waitForEvent('download');

        await page.click('#download-db-btn');

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/aoc-results-.*\.db/);
    });
});
