import { describe, expect, it } from 'vitest'
import { DEFAULT_SOLUTION, MAX_DEFAULT_LINE_LENGTH } from './constants'

describe('DEFAULT_SOLUTION', () => {
  it('should have no lines longer than MAX_DEFAULT_LINE_LENGTH', () => {
    const lines = DEFAULT_SOLUTION.split('\n')
    const longLines = lines.filter(
      (line) => line.length > MAX_DEFAULT_LINE_LENGTH,
    )

    expect(longLines).toEqual([])
  })

  it(`MAX_DEFAULT_LINE_LENGTH should be ${MAX_DEFAULT_LINE_LENGTH}`, () => {
    // This test documents the expected max line length
    // If you need to change it, update both the constant and this test
    expect(MAX_DEFAULT_LINE_LENGTH).toBe(30)
  })
})
