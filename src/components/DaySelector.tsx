import { query } from '@livestore/solid'
import { type Component, For } from 'solid-js'

import { uiState$ } from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'

// Get the latest AoC year (current year if Nov/Dec, otherwise previous year)
const getLatestAocYear = () => {
  const now = new Date()
  const month = now.getMonth() // 0-indexed: 10 = November, 11 = December
  const year = now.getFullYear()
  return month >= 10 ? year : year - 1
}

export const DaySelector: Component = () => {
  const latestYear = getLatestAocYear()
  const uiState = query(uiState$, { selectedYear: latestYear, selectedDay: 1, selectedPart: 1 as const })

  // Show 10 years starting from the latest AoC year
  const years = () => Array.from({ length: 10 }, (_, i) => latestYear - i)
  const days = () => Array.from({ length: 25 }, (_, i) => i + 1)

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
        onChange={(e) => setYear(parseInt(e.currentTarget.value))}
      >
        <For each={years()}>
          {(year) => <option value={year}>{year}</option>}
        </For>
      </select>
      <select
        value={uiState().selectedDay}
        onChange={(e) => setDay(parseInt(e.currentTarget.value))}
      >
        <For each={days()}>
          {(day) => <option value={day}>Day {day}</option>}
        </For>
      </select>
    </div>
  )
}
