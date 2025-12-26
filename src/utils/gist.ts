// GitHub Gist API utilities for export/import

const GIST_API = 'https://api.github.com/gists'

export interface GistFile {
  filename: string
  content: string
}

export interface Gist {
  id: string
  html_url: string
  description: string
  files: Record<string, { content: string; filename: string }>
  public: boolean
  created_at: string
  updated_at: string
}

export interface ExportDataV1 {
  version: 1
  exportedAt: string
  inputs: Array<{
    id: string
    year: number
    day: number
    name: string
    input: string
  }>
  solutions: Array<{
    id: string
    year: number
    day: number
    part: number
    code: string
    language: string
    result?: string
  }>
  expectedOutputs: Array<{
    id: string
    inputId: string
    part: number
    expectedOutput: string
  }>
}

export interface StoreInput {
  id: string
  year: number
  day: number
  name: string
  input: string
}

export interface StoreSolution {
  id: string
  year: number
  day: number
  part: number
  code: string
  language: string
  result: string | null
}

export interface StoreExpectedOutput {
  id: string
  inputId: string
  part: number
  expectedOutput: string
}

export interface ExportDataV2 {
  version: 2
  exportedAt: string
  inputs: Array<{
    id: string
    year: number
    day: number
    name: string
    input: string
    expectedOutputs: Array<{
      id: string
      part: number
      expectedOutput: string
    }>
  }>
  solutions: Array<{
    id: string
    year: number
    day: number
    part: number
    code: string
    language: string
    result?: string
  }>
}

export type ExportData = ExportDataV2

/**
 * Prepare export data from store state
 */
export function prepareExportData(
  inputs: readonly StoreInput[],
  solutions: readonly StoreSolution[],
  expectedOutputs: readonly StoreExpectedOutput[],
  defaultSolutionCode: string = '',
): ExportData {
  const filteredSolutions = solutions.filter(
    (s) => s.code !== defaultSolutionCode,
  )

  const expectedOutputMap = new Map<string, StoreExpectedOutput[]>()
  for (const out of expectedOutputs) {
    const existing = expectedOutputMap.get(out.inputId) || []
    existing.push(out)
    expectedOutputMap.set(out.inputId, existing)
  }

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    inputs: inputs.map((i) => {
      const expectedForInput = expectedOutputMap.get(i.id) || []

      return {
        id: i.id,
        year: i.year,
        day: i.day,
        name: i.name,
        input: i.input,
        expectedOutputs: expectedForInput.map((e) => ({
          id: e.id,
          part: e.part,
          expectedOutput: e.expectedOutput,
        })),
      }
    }),
    solutions: filteredSolutions.map((s) => ({
      id: s.id,
      year: s.year,
      day: s.day,
      part: s.part,
      code: s.code,
      language: s.language,
      result: s.result ?? undefined,
    })),
  }
}

/**
 * Build gist files from export data
 * Creates separate .sql files for each solution alongside the JSON
 */
export function buildGistFiles(
  data: ExportData,
): Record<string, { content: string }> {
  // Remove main input from export
  const filteredInputs = data.inputs.filter((i) => i.name !== 'main')
  const filteredData = { ...data, inputs: filteredInputs }

  const files: Record<string, { content: string }> = {
    'aoc-sqlite-export.json': {
      content: JSON.stringify(filteredData, null, 2),
    },
  }

  // Add each solution as a separate SQL file
  for (const solution of data.solutions) {
    if (solution.code.trim()) {
      const day = String(solution.day).padStart(2, '0')
      const filename = `${solution.year}-day${day}-part${solution.part}.sql`
      files[filename] = {
        content: solution.code,
      }
    }
  }

  return files
}

/**
 * Create a new Gist with the exported data
 */
export async function createGist(
  token: string,
  data: ExportData,
  description: string,
  isPublic: boolean,
): Promise<Gist> {
  const response = await fetch(GIST_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      description,
      public: isPublic,
      files: buildGistFiles(data),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create gist: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Update an existing Gist
 */
export async function updateGist(
  token: string,
  gistId: string,
  data: ExportData,
  description?: string,
): Promise<Gist> {
  const response = await fetch(`${GIST_API}/${gistId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      description,
      files: buildGistFiles(data),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update gist: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Fetch a Gist by ID (works for public gists without auth)
 */
export async function fetchGist(gistId: string, token?: string): Promise<Gist> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${GIST_API}/${gistId}`, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch gist: ${response.status}`)
  }

  return response.json()
}

/**
 * Parse export data from a Gist
 */
export function parseGistData(gist: Gist): ExportData | ExportDataV1 {
  const file = gist.files['aoc-sqlite-export.json']
  if (!file) {
    throw new Error('Gist does not contain aoc-sqlite-export.json')
  }

  const data = JSON.parse(file.content)
  if (data.version !== 1 && data.version !== 2) {
    throw new Error(`Unsupported export version: ${data.version}`)
  }

  return data as ExportData | ExportDataV1
}

/**
 * Extract Gist ID from a URL or return as-is if already an ID
 */
export function extractGistId(urlOrId: string): string {
  // Handle full URLs like https://gist.github.com/username/gistid
  const match = urlOrId.match(/gist\.github\.com\/[\w-]+\/([a-f0-9]+)/i)
  if (match) {
    return match[1]
  }
  // Assume it's already an ID
  return urlOrId.trim()
}

/**
 * List user's gists (requires auth)
 */
export async function listUserGists(token: string): Promise<Gist[]> {
  const response = await fetch(`${GIST_API}?per_page=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to list gists: ${response.status}`)
  }

  const gists = (await response.json()) as Gist[]
  // Filter to only show AoC exports
  return gists.filter((g) => g.files['aoc-sqlite-export.json'])
}
