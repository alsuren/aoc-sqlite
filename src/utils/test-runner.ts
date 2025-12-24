import { executeSQL, type SQLResult } from './sql-runner.ts'

export type TestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'error'

export interface TestResult {
  inputName: string
  status: TestStatus
  result?: SQLResult
  expectedOutput?: string
}

export type TestResults = Map<string, TestResult>

/**
 * Run tests for all inputs against a solution
 */
export async function runAllTests(
  code: string,
  inputs: Array<{ name: string; input: string }>,
  expectedOutputs: Map<string, string>, // Map of inputName -> expected output
  onProgress?: (results: TestResults) => void,
): Promise<TestResults> {
  const results: TestResults = new Map()

  // Initialize all as pending
  for (const input of inputs) {
    results.set(input.name, {
      inputName: input.name,
      status: 'pending',
      expectedOutput: expectedOutputs.get(input.name),
    })
  }
  onProgress?.(new Map(results))

  // Run each test
  for (const input of inputs) {
    const existing = results.get(input.name)
    // Mark as running
    results.set(input.name, {
      inputName: input.name,
      status: 'running',
      expectedOutput: existing?.expectedOutput,
    })
    onProgress?.(new Map(results))

    try {
      const sqlResult = await executeSQL(code, input.input)
      const expected = expectedOutputs.get(input.name)

      let status: TestStatus
      if (!sqlResult.success) {
        status = 'error'
      } else if (expected && sqlResult.result !== undefined) {
        status = sqlResult.result.trim() === expected.trim() ? 'pass' : 'fail'
      } else {
        // No expected output or no result - just mark as done (pass for now)
        status = 'pass'
      }

      results.set(input.name, {
        inputName: input.name,
        status,
        result: sqlResult,
        expectedOutput: expected,
      })
    } catch (error) {
      results.set(input.name, {
        inputName: input.name,
        status: 'error',
        result: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        expectedOutput: expectedOutputs.get(input.name),
      })
    }
    onProgress?.(new Map(results))
  }

  return results
}
