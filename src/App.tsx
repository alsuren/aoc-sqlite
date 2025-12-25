import type { Component } from 'solid-js'

import { DaySelector } from './components/DaySelector.tsx'
import { ExportImportPanel } from './components/ExportImportPanel.tsx'
import { InputList } from './components/InputList.tsx'
import { InputPanel } from './components/InputPanel.tsx'
import { SolutionPanel } from './components/SolutionPanel.tsx'
import { TestProvider } from './contexts/TestContext.tsx'

const App: Component = () => {
  return (
    <TestProvider>
      <div class="app">
        <h1>🎄 Advent of Code Tracker</h1>
        <DaySelector />
        <div class="panels">
          <InputPanel />
          <SolutionPanel />
        </div>
        <ExportImportPanel />
        <InputList />
      </div>
    </TestProvider>
  )
}

export default App
