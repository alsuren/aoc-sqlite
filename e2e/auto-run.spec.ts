import { expect, test } from '@playwright/test'

test.describe('Auto-run tests', () => {
  // We combine the tests into one flow to save time/setup
  test('should auto-run tests and update tab title with icon', async ({ page }) => {
    await page.goto('/')

    // Wait for the app to load
    await expect(page.locator('h1')).toContainText('Advent of Code')

    // 1. Add a test input
    await page.locator('.add-input-btn').click()
    const testTab = page.locator('.input-tab .tab-btn').filter({ hasText: 'test1' })
    await expect(testTab).toBeVisible()

    // 1.5 Fill input content
    const inputTextarea = page.locator('.panel textarea').first()
    await inputTextarea.fill('some content')

    // 2. Set expected output to "42"
    const expectedInput = page.locator('.expected-output-section input')
    await expectedInput.fill('42')

    // 3. Write a solution that outputs "42"
    // We select the second textarea which is arguably the solution one.
    // To be safer, we can check placeholder or parent class but .panel textarea:nth(1) is used in other tests.
    const solutionTextarea = page.locator('.panel textarea').nth(1) 
    await solutionTextarea.fill(`
      INSERT INTO output (progress, result)
      SELECT 1.0, '42';
    `)
    
    // Wait for auto-save and run.
    // Expect icon ✅
    const tabBtn = page.locator('.input-tab .tab-btn').filter({ hasText: 'test1' })
    
    // Use a long timeout because worker init might be slow
    await expect(tabBtn).toContainText('✅ test1', { timeout: 15000 })
    
    // Also verify class
    const tabContainer = page.locator('.input-tab').filter({ hasText: 'test1' })
    await expect(tabContainer).toHaveClass(/test-pass/)
    // Tooltip
    await expect(tabBtn).toHaveAttribute('title', '✅ Pass: Output matches expected')

    // 4. Change expected output to cause failure
    await expectedInput.fill('99')
    
    // Wait for auto-save and run.
    // Expect icon ❌
    await expect(tabBtn).toContainText('❌ test1', { timeout: 15000 })
    await expect(tabContainer).toHaveClass(/test-fail/)
    await expect(tabBtn).toHaveAttribute('title', '❌ Fail: Output does not match expected')

    // 5. Verify debouncing: type rapidly
    // Change expected back to 42 (should pass)
    await expectedInput.fill('4')
    await page.waitForTimeout(100)
    await expectedInput.fill('42')
    
    // Should eventually pass
    await expect(tabBtn).toContainText('✅ test1', { timeout: 15000 })
  })
})
