import { describe, expect, it } from 'vitest'
import { buildGistFiles } from './gist'

describe('buildGistFiles', () => {
  it('should not include main input in exported files', () => {
    const data = {
      version: 1 as const,
      exportedAt: '2025-12-25T00:00:00Z',
      inputs: [
        {
          id: '2025-01-01-main',
          year: 2025,
          day: 1,
          name: 'main',
          input: 'real input',
        },
        {
          id: '2025-01-01-test1',
          year: 2025,
          day: 1,
          name: 'test1',
          input: 'test input',
        },
      ],
      solutions: [],
      expectedOutputs: [],
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
