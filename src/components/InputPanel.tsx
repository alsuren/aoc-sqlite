import { query } from '@livestore/solid'
import { type Component, createEffect, createSignal } from 'solid-js'

import { currentInput$, uiState$ } from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'

export const InputPanel: Component = () => {
  const uiState = query(uiState$, {
    selectedYear: 2024,
    selectedDay: 1,
    selectedPart: 1 as const,
  })
  const currentInputs = query(currentInput$, [])

  const [localInput, setLocalInput] = createSignal('')

  // Sync local input with stored input when selection changes
  createEffect(() => {
    const inputs = currentInputs()
    if (inputs && inputs.length > 0) {
      setLocalInput(inputs[0].input)
    } else {
      setLocalInput('')
    }
  })

  const saveInput = () => {
    const ui = uiState()
    const id = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}`
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
          input: localInput(),
          createdAt: now,
        }),
      )
    }
  }

  return (
    <div class="panel">
      <h2>📥 Puzzle Input - Day {uiState().selectedDay}</h2>
      <textarea
        value={localInput()}
        onInput={(e) => setLocalInput(e.currentTarget.value)}
        placeholder="Paste your puzzle input here..."
      />
      <button type="button" class="save-btn" onClick={saveInput}>
        Save Input
      </button>
    </div>
  )
}
