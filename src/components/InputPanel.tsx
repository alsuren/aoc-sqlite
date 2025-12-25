import { query, query as solidQuery } from '@livestore/solid'
import {
  type Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from 'solid-js'
import { useTestContext } from '../contexts/TestContext.tsx'
import {
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

const AUTOSAVE_DELAY = 500 // ms

export const InputPanel: Component = () => {
  const uiState = query(uiState$, {
    selectedYear: 2024,
    selectedDay: 1,
    selectedPart: 1 as const,
    selectedInputName: 'main',
  })
  const rawDayInputs = query(currentDayInputs$, [])
  // Always include the main input tab, even if not present in the store
  const currentDayInputs = () => {
    const inputs = rawDayInputs()
    if (!inputs.some((i) => i.name === 'main')) {
      return [{ name: 'main', input: '' }, ...inputs]
    }
    return inputs
  }
  const currentInputs = query(currentInput$, [])
  const currentExpectedOutput = query(currentExpectedOutput$, [])

  const { getStatusForInput, isRunning: isTestsRunning } = useTestContext()

  // For rerunning tests on input change
  const currentSolutions = solidQuery(currentSolutions$, [])
  const [debounceTestTimeout, setDebounceTestTimeout] = createSignal<ReturnType<
    typeof setTimeout
  > | null>(null)
  const { runTests } = useTestContext()

  const [localInput, setLocalInput] = createSignal('')
  const [localExpectedOutput, setLocalExpectedOutput] = createSignal('')
  const [isDirty, setIsDirty] = createSignal(false)
  const [isExpectedOutputDirty, setIsExpectedOutputDirty] = createSignal(false)

  // Sync local input with stored input when selection changes
  createEffect(() => {
    const inputs = currentInputs()
    if (inputs && inputs.length > 0) {
      setLocalInput(inputs[0].input)
    } else {
      setLocalInput('')
    }
    setIsDirty(false)
  })

  // Sync local expected output with stored expected output
  createEffect(() => {
    const outputs = currentExpectedOutput()
    if (outputs && outputs.length > 0) {
      setLocalExpectedOutput(outputs[0].expectedOutput)
    } else {
      setLocalExpectedOutput('')
    }
    setIsExpectedOutputDirty(false)
  })

  const saveInput = () => {
    if (!isDirty()) return

    const ui = uiState()
    const id = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}-${ui.selectedInputName}`
    const inputs = currentInputs()
    const now = new Date()

    if (inputs && inputs.length > 0) {
      // Update existing
      store()?.commit(
        events.inputUpdated({
          id,
          input: localInput(),
          updatedAt: now,
        }),
      )
    } else {
      // Create new
      store()?.commit(
        events.inputCreated({
          id,
          year: ui.selectedYear,
          day: ui.selectedDay,
          name: ui.selectedInputName,
          input: localInput(),
          createdAt: now,
        }),
      )
    }
    setIsDirty(false)

    // Debounced rerun of tests for all inputs
    const timeout = debounceTestTimeout()
    if (timeout) clearTimeout(timeout)
    setDebounceTestTimeout(
      setTimeout(() => {
        // Find current solution for this part, or use default
        const solution = currentSolutions()?.find(
          (s) => s.part === ui.selectedPart,
        )
        const code = solution ? solution.code : DEFAULT_SOLUTION
        // Build expected outputs map for current day inputs
        const dayPrefix = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}-`
        const expectedOutputsMap = new Map<string, string>()
        for (const output of currentExpectedOutput() || []) {
          if (output.inputId.startsWith(dayPrefix)) {
            const inputName = output.inputId.slice(dayPrefix.length)
            expectedOutputsMap.set(inputName, output.expectedOutput)
          }
        }
        // Rerun tests
        runTests(
          code,
          currentDayInputs().map((i) => ({ name: i.name, input: i.input })),
          expectedOutputsMap,
        )
      }, 500),
    )
  }

  const saveExpectedOutput = () => {
    if (!isExpectedOutputDirty()) return

    const ui = uiState()
    const inputId = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}-${ui.selectedInputName}`
    const id = `${inputId}-${ui.selectedPart}`
    const now = new Date()

    store()?.commit(
      events.expectedOutputSet({
        id,
        inputId,
        part: ui.selectedPart,
        expectedOutput: localExpectedOutput(),
        updatedAt: now,
      }),
    )
    setIsExpectedOutputDirty(false)

    // Debounced rerun of tests for all inputs (same as input save)
    const timeout = debounceTestTimeout()
    if (timeout) clearTimeout(timeout)
    setDebounceTestTimeout(
      setTimeout(() => {
        const solution = currentSolutions()?.find(
          (s) => s.part === ui.selectedPart,
        )
        const code = solution ? solution.code : DEFAULT_SOLUTION
        const dayPrefix = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}-`
        const expectedOutputsMap = new Map<string, string>()
        for (const output of currentExpectedOutput() || []) {
          if (output.inputId.startsWith(dayPrefix)) {
            const inputName = output.inputId.slice(dayPrefix.length)
            expectedOutputsMap.set(inputName, output.expectedOutput)
          }
        }
        runTests(
          code,
          currentDayInputs().map((i) => ({ name: i.name, input: i.input })),
          expectedOutputsMap,
        )
      }, 500),
    )
  }

  // Debounced auto-save
  const debouncedSave = debounce(saveInput, AUTOSAVE_DELAY)
  const debouncedSaveExpectedOutput = debounce(
    saveExpectedOutput,
    AUTOSAVE_DELAY,
  )

  // Auto-save when input changes
  createEffect(() => {
    // Track localInput to trigger effect
    localInput()
    if (isDirty()) {
      debouncedSave()
    }
  })

  // Auto-save when expected output changes
  createEffect(() => {
    localExpectedOutput()
    if (isExpectedOutputDirty()) {
      debouncedSaveExpectedOutput()
    }
  })

  // Save on unmount if dirty
  onCleanup(() => {
    if (isDirty()) {
      saveInput()
    }
    if (isExpectedOutputDirty()) {
      saveExpectedOutput()
    }
  })

  const handleInput = (value: string) => {
    setLocalInput(value)
    setIsDirty(true)
  }

  const handleExpectedOutput = (value: string) => {
    setLocalExpectedOutput(value)
    setIsExpectedOutputDirty(true)
  }

  const selectInput = (name: string) => {
    // Save current input before switching
    if (isDirty()) {
      saveInput()
    }
    if (isExpectedOutputDirty()) {
      saveExpectedOutput()
    }
    store()?.commit(
      events.uiStateSet({ ...uiState(), selectedInputName: name }),
    )
  }

  const addNewInput = () => {
    // Save current input before adding new
    if (isDirty()) {
      saveInput()
    }

    // Find a unique name
    const existing = currentDayInputs()
    let newName = 'test1'
    let counter = 1
    while (existing?.some((i) => i.name === newName)) {
      counter++
      newName = `test${counter}`
    }

    // Switch to the new input (it will be created when user types)
    store()?.commit(
      events.uiStateSet({ ...uiState(), selectedInputName: newName }),
    )
  }

  const deleteInput = (name: string) => {
    const ui = uiState()
    const id = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}-${name}`

    store()?.commit(events.inputDeleted({ id }))

    // If we deleted the selected input, switch to main
    if (ui.selectedInputName === name) {
      store()?.commit(events.uiStateSet({ ...ui, selectedInputName: 'main' }))
    }
  }

  // Get CSS class for test status, suppressing flash
  const lastStableStatus = new Map<string, string>()
  const getStatusClass = (inputName: string) => {
    const status = getStatusForInput(inputName)
    if (!status) return ''
    if (status === 'pass' || status === 'fail' || status === 'error') {
      lastStableStatus.set(inputName, status)
      return `test-${status}`
    }
    // If running/pending, show last stable status if exists
    const stable = lastStableStatus.get(inputName)
    if (stable) return `test-${stable}`
    if (status === 'running') return 'test-running'
    return ''
  }

  return (
    <div class="panel">
      <h2>
        📥 Puzzle Input - Day {uiState().selectedDay}
        <Show when={isTestsRunning()}>
          <span class="testing-indicator">⏳ Testing...</span>
        </Show>
      </h2>

      <div class="input-tabs">
        <div class="input-tabs-tooltip-container">
          <span class="input-tabs-tooltip-icon" tabindex="0">
            ❓
          </span>
          <div class="input-tabs-tooltip">
            <div>
              <span class="tab-legend test-pass"></span> Pass: Output matches
              expected
            </div>
            <div>
              <span class="tab-legend test-fail"></span> Fail: Output does not
              match expected
            </div>
            <div>
              <span class="tab-legend test-running"></span> Running: Test in
              progress
            </div>
            <div>
              <span class="tab-legend test-error"></span> Error: SQL or runtime
              error
            </div>
            <div>
              <span class="tab-legend"></span> No test result yet
            </div>
          </div>
        </div>
        <For each={currentDayInputs()}>
          {(input) => (
            <div
              class={`input-tab ${uiState().selectedInputName === input.name ? 'active' : ''} ${getStatusClass(input.name)}`}
            >
              <button
                type="button"
                class="tab-btn"
                title={(() => {
                  const status = getStatusForInput(input.name)
                  if (status === 'pass')
                    return '✅ Pass: Output matches expected'
                  if (status === 'fail')
                    return '❌ Fail: Output does not match expected'
                  if (status === 'running')
                    return '⏳ Running: Test in progress'
                  if (status === 'error') return '⚠️ Error: SQL or runtime error'
                  return 'No test result yet'
                })()}
                onClick={() => selectInput(input.name)}
              >
                {input.name}
              </button>
              <Show when={input.name !== 'main'}>
                <button
                  type="button"
                  class="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteInput(input.name)
                  }}
                >
                  ×
                </button>
              </Show>
            </div>
          )}
        </For>
        <Show
          when={
            !currentDayInputs()?.some(
              (i) => i.name === uiState().selectedInputName,
            )
          }
        >
          <div class="input-tab active">
            <button type="button" class="tab-btn">
              {uiState().selectedInputName}
            </button>
          </div>
        </Show>
        <button type="button" class="add-input-btn" onClick={addNewInput}>
          +
        </button>
      </div>

      <textarea
        value={localInput()}
        onInput={(e) => handleInput(e.currentTarget.value)}
        placeholder={
          uiState().selectedInputName === 'main'
            ? 'Paste your puzzle input here...'
            : 'Paste test input here...'
        }
      />
      <div class="save-status">{isDirty() ? 'Saving...' : 'Saved'}</div>

      <Show when={uiState().selectedInputName !== 'main'}>
        <div class="expected-output-section">
          <h3>Expected Output (Part {uiState().selectedPart})</h3>
          <input
            type="text"
            value={localExpectedOutput()}
            onInput={(e) => handleExpectedOutput(e.currentTarget.value)}
            placeholder="Enter expected output for this test..."
          />
          <div class="save-status">
            {isExpectedOutputDirty() ? 'Saving...' : 'Saved'}
          </div>
        </div>
      </Show>
    </div>
  )
}
