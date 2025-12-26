import { query } from '@livestore/solid'
import { type Component, createEffect, For, onMount } from 'solid-js'

import { solutions$, uiState$ } from '../livestore/queries.ts'
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
  const solutions = query(solutions$, [])

  // Show 10 years starting from the latest AoC year
  const years = () => Array.from({ length: 10 }, (_, i) => latestYear - i)
  const days = () => Array.from({ length: 25 }, (_, i) => i + 1)

  // Check if a specific year/day has any solutions (i.e., has been seen before)
  const hasSolutionsForDay = (year: number, day: number) => {
    return solutions().some((s) => s.year === year && s.day === day)
  }

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
    const ui = uiState()
    // Reset to part 1 if the new year/day combination hasn't been seen before
    const newPart = hasSolutionsForDay(year, ui.selectedDay)
      ? ui.selectedPart
      : 1
    store()?.commit(
      events.uiStateSet({ ...ui, selectedYear: year, selectedPart: newPart }),
    )
  }

  const setDay = (day: number) => {
    const ui = uiState()
    // Reset to part 1 if the new day hasn't been seen before
    const newPart = hasSolutionsForDay(ui.selectedYear, day)
      ? ui.selectedPart
      : 1
    store()?.commit(
      events.uiStateSet({ ...ui, selectedDay: day, selectedPart: newPart }),
    )
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
