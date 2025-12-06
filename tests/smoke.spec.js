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

        // Execute a simple query
        const result = await page.evaluate(async () => {
            return await window.sqlRunner.executeSQL('SELECT 1 + 1 as result');
        });

        expect(result.success).toBe(true);
        expect(result.lastRow.result).toBe(2);
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
    test('renders year selector by default', async ({ page }) => {
        await page.goto('/');

        const yearSelector = page.locator('#year-selector');
        await expect(yearSelector).toContainText('Select Year');

        // Check for some year links
        await expect(page.locator('.year-link').first()).toBeVisible();
    });

    test('renders day selector when year is selected', async ({ page }) => {
        await page.goto('/?year=1970');

        const daySelector = page.locator('#day-selector');
        await expect(daySelector).toContainText('Select Day (1970)');

        // Check for day links
        await expect(page.locator('.day-link').first()).toBeVisible();
    });

    test('renders part selector when year and day are selected', async ({ page }) => {
        await page.goto('/?year=1970&day=1');

        const partSelector = page.locator('#part-selector');
        await expect(partSelector).toContainText('Select Part (1970-1)');

        // Check for part links
        await expect(page.locator('.part-link').first()).toBeVisible();
    });
});

test.describe('SQL File Execution', () => {
    test('can load and execute test fixture - instant completion', async ({ page }) => {
        await page.goto('/?year=1970&day=1&part=1');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Click run button
        await page.click('#run-btn');

        // Wait for completion
        await page.waitForFunction(() => {
            const progressText = document.getElementById('progress-text');
            return progressText && progressText.textContent.includes('100%');
        }, { timeout: 5000 });

        // Check result
        const resultText = await page.locator('#result-text').textContent();
        expect(resultText).toBe('42');

        // Check for completion message
        await expect(page.locator('#output-text')).toContainText('Completed');
    });

    test('handles progressive execution', async ({ page }) => {
        await page.goto('/?year=1970&day=1&part=2');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Click run button
        await page.click('#run-btn');

        // Wait for completion (should take 3 iterations)
        await page.waitForFunction(() => {
            const progressText = document.getElementById('progress-text');
            return progressText && progressText.textContent.includes('100%');
        }, { timeout: 5000 });

        // Check result
        const resultText = await page.locator('#result-text').textContent();
        expect(resultText).toBe('completed');
    });

    test('handles SQL errors gracefully', async ({ page }) => {
        await page.goto('/?year=1970&day=2&part=1');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Click run button
        await page.click('#run-btn');

        // Wait a bit for error to appear
        await page.waitForTimeout(1000);

        // Check that error is displayed
        const errorText = await page.locator('#error-text').textContent();
        expect(errorText).toBeTruthy();
        expect(errorText.length).toBeGreaterThan(0);
    });

    test('handles missing SQL file', async ({ page }) => {
        await page.goto('/?year=9999&day=99&part=9');

        // Wait for SQLite to be ready
        await page.waitForFunction(() => window.sqlRunner !== undefined, { timeout: 10000 });

        // Click run button
        await page.click('#run-btn');

        // Wait for error
        await page.waitForTimeout(1000);

        // Check that error is displayed
        const errorText = await page.locator('#error-text').textContent();
        expect(errorText).toContain('Failed to load');
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
