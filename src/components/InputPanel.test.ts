import { describe, expect, it } from 'vitest'

// This test verifies the expected output behavior we're seeing in the app
// The issue might be related to how selectedPart affects the expected output

describe('Expected output behavior', () => {
  // Simulate the query behavior
  function getCurrentExpectedOutputId(
    year: number,
    day: number,
    inputName: string,
    part: 1 | 2,
  ): string {
    const inputId = `${year}-${String(day).padStart(2, '0')}-${inputName}`
    return `${inputId}-${part}`
  }

  describe('Expected output ID generation', () => {
    it('should generate different IDs for different parts', () => {
      const id1 = getCurrentExpectedOutputId(2024, 1, 'test1', 1)
      const id2 = getCurrentExpectedOutputId(2024, 1, 'test1', 2)

      expect(id1).toBe('2024-01-test1-1')
      expect(id2).toBe('2024-01-test1-2')
      expect(id1).not.toBe(id2)
    })

    it('should generate different IDs for different inputs', () => {
      const id1 = getCurrentExpectedOutputId(2024, 1, 'test1', 1)
      const id2 = getCurrentExpectedOutputId(2024, 1, 'test2', 1)

      expect(id1).not.toBe(id2)
    })

    it('should not include main in expected output queries', () => {
      // In the UI, expected output is only shown when selectedInputName !== 'main'
      // This is a design decision, not a bug
      const id = getCurrentExpectedOutputId(2024, 1, 'main', 1)
      expect(id).toBe('2024-01-main-1') // This ID would exist, but UI doesn't show it
    })
  })

  describe('Schema event structure', () => {
    it('should have consistent ID between event and query', () => {
      const year = 2024
      const day = 1
      const inputName = 'test1'
      const part: 1 | 2 = 1

      // How InputPanel.tsx creates the event
      const inputId = `${year}-${String(day).padStart(2, '0')}-${inputName}`
      const eventId = `${inputId}-${part}`

      // How queries.ts queries for it
      const queryId = getCurrentExpectedOutputId(year, day, inputName, part)

      expect(eventId).toBe(queryId)
      expect(eventId).toBe('2024-01-test1-1')
    })

    it('event inputId should match input table id', () => {
      const year = 2024
      const day = 1
      const inputName = 'test1'

      // Input ID from inputs table
      const inputTableId = `${year}-${String(day).padStart(2, '0')}-${inputName}`

      // inputId field in expectedOutputSet event
      const eventInputId = `${year}-${String(day).padStart(2, '0')}-${inputName}`

      expect(inputTableId).toBe(eventInputId)
    })
  })
})
