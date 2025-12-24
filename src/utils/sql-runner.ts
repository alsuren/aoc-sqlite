// SQL Runner - interface to the background worker for executing AoC solutions
// Uses the same scheme as ../aoc-solutions/:
// - input_data table with 'line' column for puzzle input
// - output table with 'progress' and 'result' columns for solution output

import SQLRunnerWorker from '../sql-runner.worker.ts?worker'

export interface SQLResult {
  success: boolean
  error?: string
  progress?: number
  result?: string
  debugRows?: Array<{ progress: number; result: string }>
}

let worker: Worker | null = null
let requestId = 0
const pendingRequests = new Map<
  number,
  { resolve: (value: SQLResult) => void; reject: (error: Error) => void }
>()

function getWorker(): Worker {
  if (!worker) {
    worker = new SQLRunnerWorker()
    worker.onmessage = (event) => {
      const response = event.data
      if (response.type === 'ready') {
        // Worker is ready, initialize SQLite
        const id = ++requestId
        worker?.postMessage({ type: 'init', id })
        return
      }

      const pending = pendingRequests.get(response.id)
      if (pending) {
        pendingRequests.delete(response.id)
        if (response.type === 'success') {
          pending.resolve({
            success: true,
            progress: response.progress,
            result: response.result,
            debugRows: response.debugRows,
          })
        } else {
          pending.resolve({
            success: false,
            error: response.error,
          })
        }
      }
    }
    worker.onerror = (event) => {
      console.error('SQL Runner worker error:', event)
    }
  }
  return worker
}

/**
 * Execute SQL solution against puzzle input
 * Creates a fresh in-memory database for each execution with:
 * - input_data table populated with puzzle input lines
 * - output table for solution results
 */
export async function executeSQL(
  sql: string,
  input: string,
): Promise<SQLResult> {
  const w = getWorker()
  const id = ++requestId

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })
    w.postMessage({ type: 'execute', id, sql, input })
  })
}

/**
 * Terminate the worker (for cleanup)
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate()
    worker = null
    pendingRequests.clear()
  }
}
