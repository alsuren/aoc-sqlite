import { type Component, createSignal } from 'solid-js'

import {
  CollapsibleSection,
  isCollapsed,
  toggleCollapsed,
} from './components/CollapsibleSection.tsx'
import { DaySelector } from './components/DaySelector.tsx'
import { ExportImportPanel } from './components/ExportImportPanel.tsx'
import { InputList } from './components/InputList.tsx'
import { InputPanel } from './components/InputPanel.tsx'
import { SolutionPanel } from './components/SolutionPanel.tsx'
import { TestProvider } from './contexts/TestContext.tsx'

const App: Component = () => {
  // Collapsible state - export and saved inputs default to collapsed
  const [exportCollapsed, setExportCollapsed] = createSignal(
    isCollapsed('export', true),
  )
  const [savedInputsCollapsed, setSavedInputsCollapsed] = createSignal(
    isCollapsed('savedInputs', true),
  )

  return (
    <TestProvider>
      <div class="app">
        <h1>🎄 Advent of Code Tracker</h1>
        <DaySelector />
        <div class="panels">
          <InputPanel />
          <SolutionPanel />
        </div>
        <CollapsibleSection
          id="export"
          title="📤 Export / Import"
          defaultCollapsed={true}
          collapsed={exportCollapsed()}
          onToggle={() => setExportCollapsed(toggleCollapsed('export', true))}
        >
          <ExportImportPanel />
        </CollapsibleSection>
        <CollapsibleSection
          id="savedInputs"
          title="📋 Saved Inputs"
          defaultCollapsed={true}
          collapsed={savedInputsCollapsed()}
          onToggle={() =>
            setSavedInputsCollapsed(toggleCollapsed('savedInputs', true))
          }
        >
          <InputList />
        </CollapsibleSection>
      </div>
    </TestProvider>
  )
}

export default App
