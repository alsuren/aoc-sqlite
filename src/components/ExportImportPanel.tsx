import { query } from '@livestore/solid'
import { type Component, createSignal, For, Show } from 'solid-js'

import { expectedOutputs$, inputs$, solutions$ } from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'
import { DEFAULT_SOLUTION } from '../utils/constants.ts'
import {
  createGist,
  type ExportData,
  extractGistId,
  fetchGist,
  type Gist,
  listUserGists,
  parseGistData,
  updateGist,
} from '../utils/gist.ts'

// Store GitHub token in localStorage (not in LiveStore since it's sensitive)
const TOKEN_KEY = 'aoc-livestore-github-token'
const LAST_GIST_KEY = 'aoc-livestore-last-gist'

export const ExportImportPanel: Component = () => {
  const inputs = query(inputs$, [])
  const solutions = query(solutions$, [])
  const expectedOutputs = query(expectedOutputs$, [])

  const [token, setToken] = createSignal(localStorage.getItem(TOKEN_KEY) || '')
  const [lastGistId, setLastGistId] = createSignal(
    localStorage.getItem(LAST_GIST_KEY) || '',
  )
  const [importUrl, setImportUrl] = createSignal('')
  const [isExporting, setIsExporting] = createSignal(false)
  const [isImporting, setIsImporting] = createSignal(false)
  const [message, setMessage] = createSignal<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [showSettings, setShowSettings] = createSignal(false)
  const [userGists, setUserGists] = createSignal<Gist[]>([])
  const [isPublic, setIsPublic] = createSignal(false)

  const saveToken = (newToken: string) => {
    setToken(newToken)
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }

  const buildExportData = (): ExportData => {
    const allInputs = inputs() || []
    const allSolutions = solutions() || []
    const allExpectedOutputs = expectedOutputs() || []

    // Filter out solutions that are just the default template
    const filteredSolutions = allSolutions.filter(
      (s) => s.code !== DEFAULT_SOLUTION,
    )

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      inputs: allInputs.map((i) => ({
        id: i.id,
        year: i.year,
        day: i.day,
        name: i.name,
        input: i.input,
      })),
      solutions: filteredSolutions.map((s) => ({
        id: s.id,
        year: s.year,
        day: s.day,
        part: s.part,
        code: s.code,
        language: s.language,
        result: s.result ?? undefined,
      })),
      expectedOutputs: allExpectedOutputs.map((e) => ({
        id: e.id,
        inputId: e.inputId,
        part: e.part,
        expectedOutput: e.expectedOutput,
      })),
    }
  }

  const handleExport = async (update = false) => {
    if (!token()) {
      setMessage({ type: 'error', text: 'Please set your GitHub token first' })
      setShowSettings(true)
      return
    }

    setIsExporting(true)
    setMessage(null)

    try {
      const data = buildExportData()
      const description = `Advent of Code Solutions - Exported ${new Date().toLocaleDateString()}`

      let gist: Gist
      if (update && lastGistId()) {
        gist = await updateGist(token(), lastGistId(), data, description)
        setMessage({ type: 'success', text: 'Gist updated successfully!' })
      } else {
        gist = await createGist(token(), data, description, isPublic())
        setLastGistId(gist.id)
        localStorage.setItem(LAST_GIST_KEY, gist.id)
        setMessage({ type: 'success', text: 'Gist created successfully!' })
      }

      // Open gist in new tab
      window.open(gist.html_url, '_blank')
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Export failed',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async () => {
    const urlOrId = importUrl().trim()
    if (!urlOrId) {
      setMessage({ type: 'error', text: 'Please enter a Gist URL or ID' })
      return
    }

    setIsImporting(true)
    setMessage(null)

    try {
      const gistId = extractGistId(urlOrId)
      const gist = await fetchGist(gistId, token() || undefined)
      const data = parseGistData(gist)

      const storeInstance = store()
      if (!storeInstance) {
        throw new Error('Store not initialized')
      }

      const now = new Date()

      // Import inputs
      for (const input of data.inputs) {
        storeInstance.commit(
          events.inputCreated({
            id: input.id,
            year: input.year,
            day: input.day,
            name: input.name,
            input: input.input,
            createdAt: now,
          }),
        )
      }

      // Import solutions
      for (const solution of data.solutions) {
        storeInstance.commit(
          events.solutionCreated({
            id: solution.id,
            year: solution.year,
            day: solution.day,
            part: solution.part as 1 | 2,
            code: solution.code,
            language: solution.language,
            createdAt: now,
          }),
        )
        if (solution.result) {
          storeInstance.commit(
            events.solutionResultSet({
              id: solution.id,
              result: solution.result,
            }),
          )
        }
      }

      // Import expected outputs
      for (const expected of data.expectedOutputs) {
        storeInstance.commit(
          events.expectedOutputSet({
            id: expected.id,
            inputId: expected.inputId,
            part: expected.part as 1 | 2,
            expectedOutput: expected.expectedOutput,
            updatedAt: now,
          }),
        )
      }

      setMessage({
        type: 'success',
        text: `Imported ${data.inputs.length} inputs, ${data.solutions.length} solutions`,
      })
      setImportUrl('')
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Import failed',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const loadUserGists = async () => {
    if (!token()) return
    try {
      const gists = await listUserGists(token())
      setUserGists(gists)
    } catch {
      // Ignore errors loading gists
    }
  }

  const handleDownloadJson = () => {
    const data = buildExportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aoc-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as ExportData
        if (data.version !== 1) {
          throw new Error(`Unsupported export version: ${data.version}`)
        }

        const storeInstance = store()
        if (!storeInstance) {
          throw new Error('Store not initialized')
        }

        const now = new Date()

        for (const input of data.inputs) {
          storeInstance.commit(
            events.inputCreated({
              id: input.id,
              year: input.year,
              day: input.day,
              name: input.name,
              input: input.input,
              createdAt: now,
            }),
          )
        }

        for (const solution of data.solutions) {
          storeInstance.commit(
            events.solutionCreated({
              id: solution.id,
              year: solution.year,
              day: solution.day,
              part: solution.part as 1 | 2,
              code: solution.code,
              language: solution.language,
              createdAt: now,
            }),
          )
        }

        for (const expected of data.expectedOutputs) {
          storeInstance.commit(
            events.expectedOutputSet({
              id: expected.id,
              inputId: expected.inputId,
              part: expected.part as 1 | 2,
              expectedOutput: expected.expectedOutput,
              updatedAt: now,
            }),
          )
        }

        setMessage({
          type: 'success',
          text: `Imported ${data.inputs.length} inputs, ${data.solutions.length} solutions`,
        })
      } catch (error) {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Import failed',
        })
      }
    }
    reader.readAsText(file)
  }

  return (
    <div class="export-import-panel">
      <h2>📤 Export / Import</h2>

      <Show when={message()}>
        {(msg) => <div class={`message ${msg().type}`}>{msg().text}</div>}
      </Show>

      <div class="export-section">
        <h3>Export to Gist</h3>
        <div class="export-buttons">
          <button
            type="button"
            onClick={() => handleExport(false)}
            disabled={isExporting()}
          >
            {isExporting() ? '⏳ Exporting...' : '📤 Create New Gist'}
          </button>
          <Show when={lastGistId()}>
            <button
              type="button"
              onClick={() => handleExport(true)}
              disabled={isExporting()}
            >
              🔄 Update Last Gist
            </button>
          </Show>
          <button type="button" onClick={handleDownloadJson}>
            💾 Download JSON
          </button>
        </div>
        <label class="public-checkbox">
          <input
            type="checkbox"
            checked={isPublic()}
            onChange={(e) => setIsPublic(e.currentTarget.checked)}
          />
          Make gist public
        </label>
      </div>

      <div class="import-section">
        <h3>Import from Gist</h3>
        <div class="import-row">
          <input
            type="text"
            value={importUrl()}
            onInput={(e) => setImportUrl(e.currentTarget.value)}
            placeholder="Paste Gist URL or ID..."
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting() || !importUrl()}
          >
            {isImporting() ? '⏳ Importing...' : '📥 Import'}
          </button>
        </div>

        <div class="file-import">
          <span>Or import from file:</span>
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0]
              if (file) handleFileImport(file)
            }}
          />
        </div>

        <Show when={userGists().length > 0}>
          <div class="user-gists">
            <h4>Your Previous Exports</h4>
            <For each={userGists()}>
              {(gist) => (
                <button
                  type="button"
                  class="gist-item"
                  onClick={() => setImportUrl(gist.id)}
                >
                  {gist.description || 'Untitled'} -{' '}
                  {new Date(gist.updated_at).toLocaleDateString()}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="settings-section">
        <button
          type="button"
          class="settings-toggle"
          onClick={() => {
            setShowSettings(!showSettings())
            if (!showSettings() && token()) {
              loadUserGists()
            }
          }}
        >
          ⚙️ {showSettings() ? 'Hide' : 'Show'} Settings
        </button>

        <Show when={showSettings()}>
          <div class="settings-content">
            <label>
              GitHub Personal Access Token
              <input
                type="password"
                value={token()}
                onInput={(e) => saveToken(e.currentTarget.value)}
                placeholder="ghp_xxxxxxxxxxxx"
              />
            </label>
            <p class="token-help">
              Create a token at{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=gist&description=AoC%20LiveStore"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub Settings
              </a>{' '}
              with the <code>gist</code> scope.
            </p>
          </div>
        </Show>
      </div>
    </div>
  )
}
