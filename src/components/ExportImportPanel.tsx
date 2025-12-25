import { query } from '@livestore/solid'
import { type Component, createSignal, For, onMount, Show } from 'solid-js'

import { expectedOutputs$, inputs$, solutions$ } from '../livestore/queries.ts'
import { events } from '../livestore/schema.ts'
import { store } from '../livestore/store.ts'
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
import {
  type AuthState,
  clearAuth,
  completeDeviceFlow,
  getStoredAuth,
  isOAuthConfigured,
} from '../utils/github-auth.ts'

const LAST_GIST_KEY = 'aoc-livestore-last-gist'

export const ExportImportPanel: Component = () => {
  const inputs = query(inputs$, [])
  const solutions = query(solutions$, [])
  const expectedOutputs = query(expectedOutputs$, [])

  // Auth state
  const [authState, setAuthState] = createSignal<AuthState>({
    token: null,
    user: null,
  })
  const [isAuthenticating, setIsAuthenticating] = createSignal(false)
  const [deviceCode, setDeviceCode] = createSignal<{
    userCode: string
    verificationUri: string
  } | null>(null)

  // Export/Import state
  const [lastGistId, setLastGistId] = createSignal(
    localStorage.getItem(LAST_GIST_KEY) || '',
  )
  const [importUrl, setImportUrl] = createSignal('')
  const [isExporting, setIsExporting] = createSignal(false)
  const [isImporting, setIsImporting] = createSignal(false)
  const [message, setMessage] = createSignal<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)
  const [userGists, setUserGists] = createSignal<Gist[]>([])
  const [isPublic, setIsPublic] = createSignal(false)

  // Load stored auth on mount
  onMount(() => {
    const stored = getStoredAuth()
    if (stored.token && stored.user) {
      setAuthState(stored)
      loadUserGists()
    }
  })

  const token = () => authState().token
  const user = () => authState().user

  const handleLogin = async () => {
    if (!isOAuthConfigured()) {
      setMessage({
        type: 'error',
        text: 'GitHub OAuth not configured. Set VITE_GITHUB_CLIENT_ID.',
      })
      return
    }

    setIsAuthenticating(true)
    setMessage(null)
    setDeviceCode(null)

    try {
      const auth = await completeDeviceFlow(
        (userCode, verificationUri) => {
          setDeviceCode({ userCode, verificationUri })
          // Open GitHub verification page
          window.open(verificationUri, '_blank')
        },
        () => {
          // Polling callback - could update UI if needed
        },
      )
      setAuthState(auth)
      setDeviceCode(null)
      setMessage({ type: 'success', text: `Logged in as ${auth.user?.login}` })
      loadUserGists()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Login failed',
      })
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLogout = () => {
    clearAuth()
    setAuthState({ token: null, user: null })
    setUserGists([])
    setMessage({ type: 'info', text: 'Logged out' })
  }

  const buildExportData = (): ExportData => {
    const allInputs = inputs() || []
    const allSolutions = solutions() || []
    const allExpectedOutputs = expectedOutputs() || []

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
      solutions: allSolutions.map((s) => ({
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
    const currentToken = token()
    if (!currentToken) {
      setMessage({ type: 'error', text: 'Please log in with GitHub first' })
      return
    }

    setIsExporting(true)
    setMessage(null)

    try {
      const data = buildExportData()
      const description = `Advent of Code Solutions - Exported ${new Date().toLocaleDateString()}`

      let gist: Gist
      if (update && lastGistId()) {
        gist = await updateGist(currentToken, lastGistId(), data, description)
        setMessage({ type: 'success', text: 'Gist updated successfully!' })
      } else {
        gist = await createGist(currentToken, data, description, isPublic())
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
    const currentToken = token()
    if (!currentToken) return
    try {
      const gists = await listUserGists(currentToken)
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

      {/* Auth Section */}
      <div class="auth-section">
        <Show
          when={user()}
          fallback={
            <Show
              when={isOAuthConfigured()}
              fallback={
                <p class="oauth-not-configured">
                  GitHub OAuth not configured. To enable Gist export, set{' '}
                  <code>VITE_GITHUB_CLIENT_ID</code> environment variable.
                </p>
              }
            >
              <Show
                when={deviceCode()}
                fallback={
                  <button
                    type="button"
                    class="login-btn"
                    onClick={handleLogin}
                    disabled={isAuthenticating()}
                  >
                    {isAuthenticating()
                      ? '⏳ Waiting for authorization...'
                      : '🔐 Login with GitHub'}
                  </button>
                }
              >
                {(code) => (
                  <div class="device-code-prompt">
                    <p>
                      Enter this code on GitHub:{' '}
                      <strong class="user-code">{code().userCode}</strong>
                    </p>
                    <p class="verification-link">
                      <a
                        href={code().verificationUri}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {code().verificationUri}
                      </a>
                    </p>
                    <p class="waiting-text">Waiting for authorization...</p>
                  </div>
                )}
              </Show>
            </Show>
          }
        >
          {(currentUser) => (
            <div class="user-info">
              <img
                src={currentUser().avatar_url}
                alt={currentUser().login}
                class="avatar"
              />
              <span class="username">
                {currentUser().name || currentUser().login}
              </span>
              <button type="button" class="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </Show>
      </div>

      <div class="export-section">
        <h3>Export to Gist</h3>
        <div class="export-buttons">
          <button
            type="button"
            onClick={() => handleExport(false)}
            disabled={isExporting() || !token()}
          >
            {isExporting() ? '⏳ Exporting...' : '📤 Create New Gist'}
          </button>
          <Show when={lastGistId() && token()}>
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
        <Show when={token()}>
          <label class="public-checkbox">
            <input
              type="checkbox"
              checked={isPublic()}
              onChange={(e) => setIsPublic(e.currentTarget.checked)}
            />
            Make gist public
          </label>
        </Show>
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
    </div>
  )
}
