import { query } from '@livestore/solid'
import {
  type Component,
  createEffect,
  createSignal,
  onCleanup,
  Show,
} from 'solid-js'

import { currentSolutions$, uiState$ } from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'
import { debounce } from '../utils/debounce.ts'

const AUTOSAVE_DELAY = 500

export const SolutionPanel: Component = () => {
  const uiState = query(uiState$, {
    selectedYear: 2024,
    selectedDay: 1,
    selectedPart: 1 as const,
  })
  const currentSolutions = query(currentSolutions$, [])

  const [localCode, setLocalCode] = createSignal('')
  const [isDirty, setIsDirty] = createSignal(false)

  // Get solution for current part
  const currentSolution = () => {
    const solutions = currentSolutions()
    return solutions?.find((s) => s.part === uiState().selectedPart)
  }

  // Sync local code with stored solution when selection changes
  createEffect(() => {
    const solution = currentSolution()
    if (solution) {
      setLocalCode(solution.code)
    } else {
      setLocalCode('')
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

    const ui = uiState()
    const id = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}-${ui.selectedPart}`
    const solution = currentSolution()
    const now = new Date()

    if (solution) {
      // Update existing
      store()?.commit(
        events.solutionUpdated({
          id,
          code: localCode(),
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
          code: localCode(),
          language: 'sql',
          createdAt: now,
        }),
      )
    }
    setIsDirty(false)
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

  return (
    <div class="panel">
      <h2>💻 Solution - Day {uiState().selectedDay}</h2>
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
      <div class="save-status">{isDirty() ? 'Saving...' : 'Saved'}</div>
      <Show when={currentSolution()?.result}>
        <div class="result-panel">
          <h3>Result</h3>
          <pre>{currentSolution()?.result}</pre>
        </div>
      </Show>
    </div>
  )
}
