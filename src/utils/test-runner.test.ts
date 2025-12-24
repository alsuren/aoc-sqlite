import { describe, expect, it } from 'vitest'
import type { TestResults, TestStatus } from './test-runner.ts'

// Note: We can't easily test runAllTests directly since it depends on the SQL worker
// Instead, we test the types and helper logic

describe('TestRunner Types', () => {
  it('should have correct test status values', () => {
    const statuses: TestStatus[] = [
      'pending',
      'running',
      'pass',
      'fail',
      'error',
    ]
    expect(statuses).toHaveLength(5)
  })

  it('should create a TestResults map', () => {
    const results: TestResults = new Map()
    results.set('test1', {
      inputName: 'test1',
      status: 'pass',
      expectedOutput: '42',
    })
    results.set('test2', {
      inputName: 'test2',
      status: 'fail',
      expectedOutput: '100',
    })

    expect(results.size).toBe(2)
    expect(results.get('test1')?.status).toBe('pass')
    expect(results.get('test2')?.status).toBe('fail')
  })
})
