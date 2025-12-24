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
  currentDayInputs$,
  currentInput$,
  uiState$,
} from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'
import { debounce } from '../utils/debounce.ts'

const AUTOSAVE_DELAY = 500 // ms

export const InputPanel: Component = () => {
  const uiState = query(uiState$, {
    selectedYear: 2024,
    selectedDay: 1,
    selectedPart: 1 as const,
    selectedInputName: 'main',
  })
  const currentDayInputs = query(currentDayInputs$, [])
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

  const selectInput = (name: string) => {
    // Save current input before switching
    if (isDirty()) {
      saveInput()
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

  return (
    <div class="panel">
      <h2>📥 Puzzle Input - Day {uiState().selectedDay}</h2>

      <div class="input-tabs">
        <For each={currentDayInputs()}>
          {(input) => (
            <div
              class={`input-tab ${uiState().selectedInputName === input.name ? 'active' : ''}`}
            >
              <button
                type="button"
                class="tab-btn"
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
    </div>
  )
}
