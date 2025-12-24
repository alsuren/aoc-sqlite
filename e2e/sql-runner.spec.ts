import { test, expect } from '@playwright/test'

test.describe('SQL Runner', () => {
  test('should execute simple SQL and show result', async ({ page }) => {
    await page.goto('/')

    // Wait for the app to load
    await expect(page.locator('h1')).toContainText('Advent of Code')

    // Add some test input
    const inputTextarea = page.locator('.panel textarea').first()
    await inputTextarea.fill('line1\nline2\nline3')

    // Wait for auto-save
    await page.waitForTimeout(600)

    // Write a simple SQL solution
    const solutionTextarea = page.locator('.panel textarea').nth(1)
    await solutionTextarea.fill(`
-- Count lines in input
INSERT INTO output (progress, result)
SELECT 1.0, COUNT(*) FROM input_data;
`)

    // Wait for auto-save
    await page.waitForTimeout(600)

    // Click Run button
    const runButton = page.locator('button.run-btn')
    await expect(runButton).toBeVisible()
    await runButton.click()

    // Wait for result to appear
    await expect(page.locator('.result-panel')).toBeVisible({ timeout: 10000 })

    // Check that the result shows 3 (number of lines)
    await expect(page.locator('.final-result')).toContainText('3')
  })

  test('should show error for invalid SQL', async ({ page }) => {
    await page.goto('/')

    // Add some input
    const inputTextarea = page.locator('.panel textarea').first()
    await inputTextarea.fill('test')
    await page.waitForTimeout(600)

    // Write invalid SQL
    const solutionTextarea = page.locator('.panel textarea').nth(1)
    await solutionTextarea.fill('SELECT * FROM nonexistent_table;')
    await page.waitForTimeout(600)

    // Click Run
    await page.locator('button.run-btn').click()

    // Should show error
    await expect(page.locator('.result-panel.error')).toBeVisible({
      timeout: 10000,
    })
  })

  test('should show debug output for progress < 1', async ({ page }) => {
    await page.goto('/')

    // Add input
    const inputTextarea = page.locator('.panel textarea').first()
    await inputTextarea.fill('a\nb\nc\nd\ne')
    await page.waitForTimeout(600)

    // SQL with debug output
    const solutionTextarea = page.locator('.panel textarea').nth(1)
    await solutionTextarea.fill(`
-- Debug: show intermediate count
INSERT INTO output (progress, result)
SELECT 0.5, 'Processing ' || COUNT(*) || ' lines' FROM input_data;

-- Final result
INSERT INTO output (progress, result)
SELECT 1.0, COUNT(*) FROM input_data;
`)
    await page.waitForTimeout(600)

    // Run
    await page.locator('button.run-btn').click()

    // Should show debug output
    await expect(page.locator('.debug-rows')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.debug-row').first()).toContainText(
      'Processing 5 lines',
    )

    // And final result
    await expect(page.locator('.final-result')).toContainText('5')
  })

  test('should auto-run tests on save and color tabs', async ({ page }) => {
    await page.goto('/')

    // Wait for app to load
    await expect(page.locator('h1')).toContainText('Advent of Code')

    // Add main input
    const inputTextarea = page.locator('.panel textarea').first()
    await inputTextarea.fill('1\n2\n3')
    await page.waitForTimeout(600)

    // Add a test input by clicking +
    await page.locator('.add-input-btn').click()
    await page.waitForTimeout(100)

    // Fill test input
    await inputTextarea.fill('a\nb')
    await page.waitForTimeout(100)

    // Set expected output
    const expectedInput = page.locator('.expected-output-section input')
    await expectedInput.fill('2')
    await page.waitForTimeout(600)

    // Write a SQL solution that counts lines
    const solutionTextarea = page.locator('.panel textarea').nth(1)
    await solutionTextarea.fill(`
INSERT INTO output (progress, result)
SELECT 1.0, COUNT(*) FROM input_data;
`)

    // Wait for auto-save to trigger tests
    await page.waitForTimeout(1000)

    // The test1 input tab should turn green (pass) since COUNT(*) = 2 matches expected "2"
    await expect(
      page.locator('.input-tab.test-pass').filter({ hasText: 'test1' }),
    ).toBeVisible({
      timeout: 10000,
    })
  })
})
