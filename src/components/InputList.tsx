import { query } from '@livestore/solid'
import { type Component, For, Show } from 'solid-js'

import { inputs$ } from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'

export const InputList: Component = () => {
  const inputs = query(inputs$, [])

  const selectInput = (year: number, day: number) => {
    store()?.commit(
      events.uiStateSet({
        selectedYear: year,
        selectedDay: day,
        selectedPart: 1,
      }),
    )
  }

  return (
    <div class="input-list">
      <h2>📋 Saved Inputs</h2>
      <Show
        when={inputs()?.length}
        fallback={
          <p>No inputs saved yet. Paste your first puzzle input above!</p>
        }
      >
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Day</th>
              <th>Input Preview</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            <For each={inputs()}>
              {(input) => (
                <tr onClick={() => selectInput(input.year, input.day)}>
                  <td>{input.year}</td>
                  <td>Day {input.day}</td>
                  <td>
                    {input.input.substring(0, 50)}
                    {input.input.length > 50 ? '...' : ''}
                  </td>
                  <td>
                    {input.updatedAt
                      ? new Date(input.updatedAt).toLocaleDateString()
                      : input.createdAt
                        ? new Date(input.createdAt).toLocaleDateString()
                        : '-'}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  )
}
