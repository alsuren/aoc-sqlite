import { query } from '@livestore/solid'
import { type Component, createSignal, createEffect, Show } from 'solid-js'

import { uiState$, currentSolutions$ } from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'

export const SolutionPanel: Component = () => {
  const uiState = query(uiState$, { selectedYear: 2024, selectedDay: 1, selectedPart: 1 as const })
  const currentSolutions = query(currentSolutions$, [])

  const [localCode, setLocalCode] = createSignal('')

  // Get solution for current part
  const currentSolution = () => {
    const solutions = currentSolutions()
    return solutions?.find(s => s.part === uiState().selectedPart)
  }

  // Sync local code with stored solution when selection changes
  createEffect(() => {
    const solution = currentSolution()
    if (solution) {
      setLocalCode(solution.code)
    } else {
      setLocalCode('')
    }
  })

  const setPart = (part: 1 | 2) => {
    store()?.commit(events.uiStateSet({ ...uiState(), selectedPart: part }))
  }

  const saveSolution = () => {
    const ui = uiState()
    const id = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}-${ui.selectedPart}`
    const solution = currentSolution()
    const now = new Date()

    if (solution) {
      // Update existing
      store()?.commit(events.solutionUpdated({
        id,
        code: localCode(),
        updatedAt: now,
      }))
    } else {
      // Create new
      store()?.commit(events.solutionCreated({
        id,
        year: ui.selectedYear,
        day: ui.selectedDay,
        part: ui.selectedPart,
        code: localCode(),
        language: 'sql',
        createdAt: now,
      }))
    }
  }

  return (
    <div class="panel">
      <h2>💻 Solution - Day {uiState().selectedDay}</h2>
      <div class="part-tabs">
        <button
          class={uiState().selectedPart === 1 ? 'active' : ''}
          onClick={() => setPart(1)}
        >
          Part 1
        </button>
        <button
          class={uiState().selectedPart === 2 ? 'active' : ''}
          onClick={() => setPart(2)}
        >
          Part 2
        </button>
      </div>
      <textarea
        value={localCode()}
        onInput={(e) => setLocalCode(e.currentTarget.value)}
        placeholder="Write your SQL solution here..."
      />
      <button class="save-btn" onClick={saveSolution}>
        Save Solution
      </button>
      <Show when={currentSolution()?.result}>
        <div class="result-panel">
          <h3>Result</h3>
          <pre>{currentSolution()?.result}</pre>
        </div>
      </Show>
    </div>
  )
}
