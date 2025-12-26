import { describe, expect, it } from 'vitest'
import {
  buildGistFiles,
  prepareExportData,
  type StoreExpectedOutput,
  type StoreInput,
  type StoreSolution,
} from './gist'

describe('prepareExportData', () => {
  it('should correctly organize solutions and expected outputs into inputs', () => {
    const inputs: StoreInput[] = [
      {
        id: '2024-01-main',
        year: 2024,
        day: 1,
        name: 'main',
        input: 'main input',
      },
      {
        id: '2024-01-test1',
        year: 2024,
        day: 1,
        name: 'test1',
        input: 'test input',
      },
    ]

    const solutions: StoreSolution[] = [
      {
        id: '2024-01-1',
        year: 2024,
        day: 1,
        part: 1,
        code: 'part 1 code',
        language: 'sql',
        result: 'result 1',
      },
      {
        id: '2024-01-2',
        year: 2024,
        day: 1,
        part: 2,
        code: 'part 2 code',
        language: 'sql',
        result: 'result 2',
      },
      // Solution for another day
      {
        id: '2024-02-1',
        year: 2024,
        day: 2,
        part: 1,
        code: 'day 2 code',
        language: 'sql',
        result: null,
      },
    ]

    const expectedOutputs: StoreExpectedOutput[] = [
      {
        id: 'out1',
        inputId: '2024-01-test1',
        part: 1,
        expectedOutput: '42',
      },
      {
        id: 'out2',
        inputId: '2024-01-test1',
        part: 2,
        expectedOutput: '100',
      },
    ]

    const result = prepareExportData(inputs, solutions, expectedOutputs)

    expect(result.version).toBe(2)
    expect(result.inputs).toHaveLength(2)

    // Check main input
    const mainInput = result.inputs.find((i) => i.name === 'main')
    expect(mainInput).toBeDefined()
    expect(mainInput!.expectedOutputs).toHaveLength(0)

    // Check test input - should have expected outputs (by input ID)
    const testInput = result.inputs.find((i) => i.name === 'test1')
    expect(testInput).toBeDefined()
    expect(testInput!.expectedOutputs).toHaveLength(2)
    
    const p1Output = testInput!.expectedOutputs.find(e => e.part === 1)
    expect(p1Output?.expectedOutput).toBe('42')
    
    const p2Output = testInput!.expectedOutputs.find(e => e.part === 2)
    expect(p2Output?.expectedOutput).toBe('100')

    // Check top-level solutions
    expect(result.solutions).toHaveLength(3)
    const day1Solutions = result.solutions.filter(s => s.year === 2024 && s.day === 1)
    expect(day1Solutions).toHaveLength(2)
    expect(day1Solutions.map(s => s.part).sort()).toEqual([1, 2])
  })
})

describe('buildGistFiles', () => {
  it('should not include main input in exported files', () => {
    const data = {
      version: 2 as const,
      exportedAt: '2025-12-25T00:00:00Z',
      inputs: [
        {
          id: '2025-01-01-main',
          year: 2025,
          day: 1,
          name: 'main',
          input: 'real input',
          expectedOutputs: [],
        },
        {
          id: '2025-01-01-test1',
          year: 2025,
          day: 1,
          name: 'test1',
          input: 'test input',
          expectedOutputs: [],
        },
      ],
      solutions: [],
    }
    const files = buildGistFiles(data)
    const json = JSON.parse(
      files['aoc-sqlite-export.json'].content,
    ) as typeof data
    const inputNames = json.inputs.map((i) => i.name)
    expect(inputNames).not.toContain('main')
    expect(inputNames).toContain('test1')
  })
})
