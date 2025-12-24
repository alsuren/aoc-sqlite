import type { Component } from 'solid-js'

import { DaySelector } from './components/DaySelector.tsx'
import { InputList } from './components/InputList.tsx'
import { InputPanel } from './components/InputPanel.tsx'
import { SolutionPanel } from './components/SolutionPanel.tsx'

const App: Component = () => {
  return (
    <div class="app">
      <h1>🎄 Advent of Code Tracker</h1>
      <DaySelector />
      <div class="panels">
        <InputPanel />
        <SolutionPanel />
      </div>
      <InputList />
    </div>
  )
}

export default App
