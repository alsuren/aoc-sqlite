import { query } from '@livestore/solid'
import { type Component, createEffect, For, onMount } from 'solid-js'

import { uiState$ } from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'
import { getLatestAocYear, parseUrlHash, updateUrlHash } from '../utils/url.ts'

export const DaySelector: Component = () => {
  const latestYear = getLatestAocYear()
  const uiState = query(uiState$, {
    selectedYear: latestYear,
    selectedDay: 1,
    selectedPart: 1 as const,
    selectedInputName: 'main',
  })

  // Show 10 years starting from the latest AoC year
  const years = () => Array.from({ length: 10 }, (_, i) => latestYear - i)
  const days = () => Array.from({ length: 25 }, (_, i) => i + 1)

  // On mount, read URL and update state if valid
  onMount(() => {
    const urlState = parseUrlHash()
    if (urlState) {
      store()?.commit(
        events.uiStateSet({
          selectedYear: urlState.year,
          selectedDay: urlState.day,
          selectedPart: urlState.part,
          selectedInputName: 'main',
        }),
      )
    }
  })

  // Keep URL in sync with state changes
  createEffect(() => {
    const ui = uiState()
    updateUrlHash(ui.selectedYear, ui.selectedDay, ui.selectedPart)
  })

  const setYear = (year: number) => {
    store()?.commit(events.uiStateSet({ ...uiState(), selectedYear: year }))
  }

  const setDay = (day: number) => {
    store()?.commit(events.uiStateSet({ ...uiState(), selectedDay: day }))
  }

  return (
    <div class="day-selector">
      <select
        value={uiState().selectedYear}
        onChange={(e) => setYear(Number.parseInt(e.currentTarget.value, 10))}
      >
        <For each={years()}>
          {(year) => <option value={year}>{year}</option>}
        </For>
      </select>
      <select
        value={uiState().selectedDay}
        onChange={(e) => setDay(Number.parseInt(e.currentTarget.value, 10))}
      >
        <For each={days()}>
          {(day) => <option value={day}>Day {day}</option>}
        </For>
      </select>
    </div>
  )
}
