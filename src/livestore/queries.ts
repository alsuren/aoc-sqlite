import { queryDb } from '@livestore/livestore'

import { tables } from './schema.ts'

export const uiState$ = queryDb(tables.uiState.get(), { label: 'uiState' })

export const inputs$ = queryDb(
  tables.inputs.orderBy('year', 'desc').orderBy('day', 'asc'),
  {
    label: 'inputs',
  },
)

export const solutions$ = queryDb(
  tables.solutions
    .orderBy('year', 'desc')
    .orderBy('day', 'asc')
    .orderBy('part', 'asc'),
  {
    label: 'solutions',
  },
)

// Get input for currently selected day
export const currentInput$ = queryDb(
  (get) => {
    const ui = get(uiState$)
    const id = `${ui.selectedYear}-${String(ui.selectedDay).padStart(2, '0')}`
    return tables.inputs.where({ id })
  },
  { label: 'currentInput' },
)

// Get solutions for currently selected day
export const currentSolutions$ = queryDb(
  (get) => {
    const ui = get(uiState$)
    return tables.solutions.where({
      year: ui.selectedYear,
      day: ui.selectedDay,
    })
  },
  { label: 'currentSolutions' },
)
