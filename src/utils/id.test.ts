import { describe, expect, it } from 'vitest'

// Test ID generation logic used across the app
// These helpers mirror the ID generation in InputPanel and queries

function makeInputId(year: number, day: number, name: string): string {
  return `${year}-${String(day).padStart(2, '0')}-${name}`
}

function makeExpectedOutputId(inputId: string, part: 1 | 2): string {
  return `${inputId}-${part}`
}

function makeSolutionId(year: number, day: number, part: 1 | 2): string {
  return `${year}-${String(day).padStart(2, '0')}-${part}`
}

describe('ID generation', () => {
  describe('makeInputId', () => {
    it('should generate correct ID for main input', () => {
      expect(makeInputId(2024, 1, 'main')).toBe('2024-01-main')
    })

    it('should generate correct ID for test input', () => {
      expect(makeInputId(2024, 1, 'test1')).toBe('2024-01-test1')
    })

    it('should zero-pad single digit days', () => {
      expect(makeInputId(2024, 5, 'main')).toBe('2024-05-main')
    })

    it('should not zero-pad double digit days', () => {
      expect(makeInputId(2024, 15, 'main')).toBe('2024-15-main')
    })
  })

  describe('makeExpectedOutputId', () => {
    it('should generate correct ID for part 1', () => {
      const inputId = makeInputId(2024, 1, 'test1')
      expect(makeExpectedOutputId(inputId, 1)).toBe('2024-01-test1-1')
    })

    it('should generate correct ID for part 2', () => {
      const inputId = makeInputId(2024, 1, 'test1')
      expect(makeExpectedOutputId(inputId, 2)).toBe('2024-01-test1-2')
    })
  })

  describe('makeSolutionId', () => {
    it('should generate correct ID for part 1', () => {
      expect(makeSolutionId(2024, 1, 1)).toBe('2024-01-1')
    })

    it('should generate correct ID for part 2', () => {
      expect(makeSolutionId(2024, 25, 2)).toBe('2024-25-2')
    })
  })
})

// Test that the ID parsing works both ways
describe('ID round-trip', () => {
  it('should be able to extract components from input ID', () => {
    const id = makeInputId(2024, 5, 'test1')
    // ID format: "2024-05-test1"
    const parts = id.split('-')
    expect(parts[0]).toBe('2024') // year
    expect(parts[1]).toBe('05') // day (padded)
    expect(parts[2]).toBe('test1') // name
  })

  it('should be able to extract components from expected output ID', () => {
    const inputId = makeInputId(2024, 5, 'test1')
    const id = makeExpectedOutputId(inputId, 1)
    // ID format: "2024-05-test1-1"
    const parts = id.split('-')
    expect(parts[0]).toBe('2024') // year
    expect(parts[1]).toBe('05') // day (padded)
    expect(parts[2]).toBe('test1') // name
    expect(parts[3]).toBe('1') // part
  })

  it('expected output ID with name containing numbers', () => {
    const inputId = makeInputId(2024, 5, 'test123')
    const id = makeExpectedOutputId(inputId, 2)
    // ID format: "2024-05-test123-2"
    expect(id).toBe('2024-05-test123-2')
    const parts = id.split('-')
    expect(parts).toEqual(['2024', '05', 'test123', '2'])
  })
})
