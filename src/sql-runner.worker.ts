// SQL Runner Worker - executes user SQL in an isolated SQLite instance
// Uses @livestore/wa-sqlite with in-memory database for each execution

import * as SQLite from '@livestore/wa-sqlite'

type SQLiteAPI = ReturnType<typeof SQLite.Factory>

let sqlite3: SQLiteAPI | null = null

interface ExecuteRequest {
  type: 'execute'
  id: number
  sql: string
  input: string
}

interface InitRequest {
  type: 'init'
  id: number
}

type Request = ExecuteRequest | InitRequest

interface SuccessResponse {
  type: 'success'
  id: number
  progress?: number
  result?: string
  debugRows?: Array<{ progress: number; result: string }>
}

interface ErrorResponse {
  type: 'error'
  id: number
  error: string
}

async function initSQLite(): Promise<void> {
  if (sqlite3) return

  // Import and instantiate wa-sqlite
  const { default: moduleFactory } = await import(
    '@livestore/wa-sqlite/dist/wa-sqlite.mjs'
  )
  const module = await moduleFactory()
  sqlite3 = SQLite.Factory(module)
}

async function executeSQL(
  sql: string,
  input: string,
): Promise<SuccessResponse | ErrorResponse> {
  if (!sqlite3) {
    throw new Error('SQLite not initialized')
  }

  // Create a fresh database for this execution
  const db = await sqlite3.open_v2(':memory:')

  try {
    // Create required tables
    await sqlite3.exec(
      db,
      `
      CREATE TABLE input_data (line TEXT);
      CREATE TABLE output (progress REAL, result TEXT);
    `,
    )

    // Populate input_data with puzzle input lines
    const lines = input.split('\n')
    for (const line of lines) {
      const escapedLine = line.replace(/'/g, "''")
      await sqlite3.exec(
        db,
        `INSERT INTO input_data (line) VALUES ('${escapedLine}')`,
      )
    }

    // Execute the user's SQL
    await sqlite3.exec(db, sql)

    // Collect results from output table
    const rows: Array<{ progress: number; result: string }> = []
    await sqlite3.exec(
      db,
      'SELECT progress, result FROM output ORDER BY progress',
      (row, columns) => {
        const progressIdx = columns.indexOf('progress')
        const resultIdx = columns.indexOf('result')
        rows.push({
          progress: Number(row[progressIdx]),
          result: String(row[resultIdx] ?? ''),
        })
      },
    )

    if (rows.length === 0) {
      return {
        type: 'error',
        id: 0,
        error:
          'SQL executed but did not INSERT INTO output with progress and result columns.\n\nYour solution should end with something like:\nINSERT INTO output (progress, result) VALUES (1.0, your_answer);',
      }
    }

    // Separate debug rows (progress < 1) from final result (progress >= 1)
    const debugRows = rows.filter((r) => r.progress < 1)
    const finalRow = rows.find((r) => r.progress >= 1)

    return {
      type: 'success',
      id: 0,
      progress: finalRow?.progress ?? Math.max(...rows.map((r) => r.progress)),
      result: finalRow?.result,
      debugRows: debugRows.length > 0 ? debugRows : undefined,
    }
  } catch (error) {
    return {
      type: 'error',
      id: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    // Always close the database
    try {
      await sqlite3.close(db)
    } catch (error) {
      console.error(
        'FIXME: clean up sqlite properly in this error case:',
        // Error: unable to close due to unfinalized statements or unfinished backups
        error,
      )
    }
  }
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data

  if (request.type === 'init') {
    try {
      await initSQLite()
      const response: SuccessResponse = { type: 'success', id: request.id }
      self.postMessage(response)
    } catch (error) {
      const response: ErrorResponse = {
        type: 'error',
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      }
      self.postMessage(response)
    }
  } else if (request.type === 'execute') {
    const result = await executeSQL(request.sql, request.input)
    result.id = request.id
    self.postMessage(result)
  }
}

// Signal that worker is ready
self.postMessage({ type: 'ready' })
