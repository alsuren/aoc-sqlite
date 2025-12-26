import { query } from '@livestore/solid'
import {
  type Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from 'solid-js'

import {
  CollapsibleSection,
  isCollapsed,
  toggleCollapsed,
} from './CollapsibleSection.tsx'

import { useTestContext } from '../contexts/TestContext.tsx'
import {
  currentDayExpectedOutputs$,
  currentDayInputs$,
  currentExpectedOutput$,
  currentInput$,
  currentSolutions$,
  uiState$,
} from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'
import { DEFAULT_SOLUTION } from '../utils/constants.ts'
import { debounce } from '../utils/debounce.ts'
import { executeSQL, type SQLResult } from '../utils/sql-runner.ts'

const AUTOSAVE_DELAY = 500

export const SolutionPanel: Component = () => {
  const uiState = query(uiState$, {
    selectedYear: 2024,
    selectedDay: 1,
    selectedPart: 1 as const,
    selectedInputName: 'main',
  })
  const currentSolutions = query(currentSolutions$, [])
  const currentInput = query(currentInput$, [])
  const currentExpectedOutput = query(currentExpectedOutput$, [])
  const currentDayInputs = query(currentDayInputs$, [])
  const currentDayExpectedOutputs = query(currentDayExpectedOutputs$, [])

  const { runTests } = useTestContext()

  const [localCode, setLocalCode] = createSignal('')
  const [isDirty, setIsDirty] = createSignal(false)
  const [isRunning, setIsRunning] = createSignal(false)
  const [runResult, setRunResult] = createSignal<SQLResult | null>(null)
  
  const [collapsed, setCollapsed] = createSignal(
    isCollapsed('solutionPanel', false),
  )

  // Get solution for current part
  const currentSolution = () => {
    const solutions = currentSolutions()
    return solutions?.find((s) => s.part === uiState().selectedPart)
  }

  // Clear result when UI selection changes (day, part, or input)
  createEffect(() => {
    // Access uiState to track changes
    const _ui = uiState()
    // Clear the result panel when selection changes
    setRunResult(null)
  })

  // Sync local code with stored solution when selection changes
  createEffect(() => {
    const solution = currentSolution()
    if (solution) {
      setLocalCode(solution.code)
    } else {
      setLocalCode(DEFAULT_SOLUTION)
    }
    setIsDirty(false)
  })

  const setPart = (part: 1 | 2) => {
    // Save before switching parts if dirty
    if (isDirty()) {
      saveSolution()
    }
    store()?.commit(events.uiStateSet({ ...uiState(), selectedPart: part }))
  }

  const saveSolution = () => {
    if (!isDirty()) return

    // Don't save if code is the default template (unless updating existing)
    const code = localCode()
    const solution = currentSolution()
    if (!solution && code === DEFAULT_SOLUTION) {
      setIsDirty(false)
      return
    }

    const ui = uiState()
    const id = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}-${ui.selectedPart}`
    const now = new Date()

    if (solution) {
      // Update existing
      store()?.commit(
        events.solutionUpdated({
          id,
          code,
          updatedAt: now,
        }),
      )
    } else {
      // Create new
      store()?.commit(
        events.solutionCreated({
          id,
          year: ui.selectedYear,
          day: ui.selectedDay,
          part: ui.selectedPart,
          code,
          language: 'sql',
          createdAt: now,
        }),
      )
    }
    setIsDirty(false)

    // Run all tests after saving
    runAllInputTests()
  }

  // Run tests for all inputs
  const runAllInputTests = () => {
    const code = localCode()
    if (!code.trim()) return

    const ui = uiState()
    const inputs = currentDayInputs()
    if (!inputs || inputs.length === 0) return

    // Build expected outputs map for current day inputs
    const expectedOutputsMap = new Map<string, string>()
    const dayPrefix = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}-`
    for (const output of currentDayExpectedOutputs() || []) {
      // output.inputId is like "2024-01-test1", we want just "test1"
      if (output.inputId.startsWith(dayPrefix)) {
        const inputName = output.inputId.slice(dayPrefix.length)
        expectedOutputsMap.set(inputName, output.expectedOutput)
      }
    }

    // Run tests
    runTests(
      code,
      inputs.map((i) => ({ name: i.name, input: i.input })),
      expectedOutputsMap,
    )
  }

  // Debounced auto-save
  const debouncedSave = debounce(() => {
    saveSolution()
  }, AUTOSAVE_DELAY)

  // Trigger auto-save when code changes
  createEffect(() => {
    if (isDirty()) {
      debouncedSave()
    }
  })

  // Save on unmount if dirty
  onCleanup(() => {
    if (isDirty()) {
      saveSolution()
    }
  })

  const handleCodeInput = (value: string) => {
    setLocalCode(value)
    setIsDirty(true)
  }

  const runSolution = async () => {
    const input = currentInput()
    if (!input || input.length === 0) {
      setRunResult({
        success: false,
        error: 'No input data. Please add puzzle input first.',
      })
      return
    }

    setIsRunning(true)
    setRunResult(null)

    try {
      const result = await executeSQL(localCode(), input[0].input)
      setRunResult(result)

      // If successful with a final result, save it to the solution
      if (result.success && result.result !== undefined) {
        const ui = uiState()
        const id = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}-${ui.selectedPart}`
        store()?.commit(events.solutionResultSet({ id, result: result.result }))
      }
    } catch (error) {
      setRunResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsRunning(false)
    }
  }

  // Get expected output for comparison
  const expectedOutput = () => {
    const outputs = currentExpectedOutput()
    return outputs && outputs.length > 0 ? outputs[0].expectedOutput : null
  }

  // Check if result matches expected output
  const resultMatches = () => {
    const expected = expectedOutput()
    const result = runResult()
    if (!expected || !result?.result) return null
    return result.result.trim() === expected.trim()
  }

  return (
    <CollapsibleSection
      id="solutionPanel"
      title={`💻 Solution - Day ${uiState().selectedDay}`}
      collapsed={collapsed()}
      onToggle={() => setCollapsed(toggleCollapsed('solutionPanel', false))}
    >
      <div class="panel">
      <div class="part-tabs">
        <button
          type="button"
          class={uiState().selectedPart === 1 ? 'active' : ''}
          onClick={() => setPart(1)}
        >
          Part 1
        </button>
        <button
          type="button"
          class={uiState().selectedPart === 2 ? 'active' : ''}
          onClick={() => setPart(2)}
        >
          Part 2
        </button>
      </div>
      <textarea
        value={localCode()}
        onInput={(e) => handleCodeInput(e.currentTarget.value)}
        placeholder="Write your SQL solution here..."
      />
      <div class="solution-actions">
        <div class="save-status">{isDirty() ? 'Saving...' : 'Saved'}</div>
        <button
          type="button"
          class="run-btn"
          onClick={runSolution}
          disabled={isRunning() || !localCode()}
        >
          {isRunning() ? '⏳ Running...' : '▶️ Run'}
        </button>
      </div>

      <Show when={runResult()}>
        {(result) => (
          <div
            class={`result-panel ${result().success ? 'success' : 'error'} ${resultMatches() === true ? 'matches' : resultMatches() === false ? 'mismatch' : ''}`}
          >
            <h3>
              {result().success ? '✅ Result' : '❌ Error'}
              <Show when={resultMatches() === true}>
                <span class="match-badge">✓ Matches expected</span>
              </Show>
              <Show when={resultMatches() === false}>
                <span class="mismatch-badge">✗ Does not match expected</span>
              </Show>
            </h3>
            <Show when={result().error}>
              <pre class="error-output">{result().error}</pre>
            </Show>
            <Show when={(result().debugRows?.length ?? 0) > 0}>
              <div class="debug-rows">
                <h4>Debug Output</h4>
                <For each={result().debugRows}>
                  {(row) => (
                    <div class="debug-row">
                      <span class="progress">
                        {Math.round(row.progress * 100)}%
                      </span>
                      <span class="debug-result">{row.result}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={result().result !== undefined}>
              <div class="final-result">
                <strong>Answer:</strong> {result().result}
              </div>
              <Show when={expectedOutput()}>
                <div class="expected-result">
                  <strong>Expected:</strong> {expectedOutput()}
                </div>
              </Show>
            </Show>
          </div>
        )}
      </Show>

      <div class="input-info">
        Running against: <strong>{uiState().selectedInputName}</strong> input
        <Show when={!currentInput() || currentInput().length === 0}>
          <span class="warning"> (no input data)</span>
        </Show>
      </div>
      </div>
    </CollapsibleSection>
  )
}
