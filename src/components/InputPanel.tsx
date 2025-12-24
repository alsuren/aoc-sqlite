import { query } from '@livestore/solid'
import { type Component, createEffect, createSignal, onCleanup } from 'solid-js'

import { currentInput$, uiState$ } from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'
import { debounce } from '../utils/debounce.ts'

const AUTOSAVE_DELAY = 500 // ms

export const InputPanel: Component = () => {
  const uiState = query(uiState$, {
    selectedYear: 2024,
    selectedDay: 1,
    selectedPart: 1 as const,
  })
  const currentInputs = query(currentInput$, [])

  const [localInput, setLocalInput] = createSignal('')
  const [isDirty, setIsDirty] = createSignal(false)

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

  const saveInput = () => {
    if (!isDirty()) return

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
    setIsDirty(false)
  }

  // Debounced auto-save
  const debouncedSave = debounce(saveInput, AUTOSAVE_DELAY)

  // Auto-save when input changes
  createEffect(() => {
    // Track localInput to trigger effect
    localInput()
    if (isDirty()) {
      debouncedSave()
    }
  })

  // Save on unmount if dirty
  onCleanup(() => {
    if (isDirty()) {
      saveInput()
    }
  })

  const handleInput = (value: string) => {
    setLocalInput(value)
    setIsDirty(true)
  }

  return (
    <div class="panel">
      <h2>📥 Puzzle Input - Day {uiState().selectedDay}</h2>
      <textarea
        value={localInput()}
        onInput={(e) => handleInput(e.currentTarget.value)}
        placeholder="Paste your puzzle input here..."
      />
      <div class="save-status">{isDirty() ? 'Saving...' : 'Saved'}</div>
    </div>
  )
}
