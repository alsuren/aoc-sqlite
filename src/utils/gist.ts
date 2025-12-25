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

export interface ExportData {
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
      files: {
        'aoc-livestore-export.json': {
          content: JSON.stringify(data, null, 2),
        },
      },
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
      files: {
        'aoc-livestore-export.json': {
          content: JSON.stringify(data, null, 2),
        },
      },
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
export function parseGistData(gist: Gist): ExportData {
  const file = gist.files['aoc-livestore-export.json']
  if (!file) {
    throw new Error('Gist does not contain aoc-livestore-export.json')
  }

  const data = JSON.parse(file.content) as ExportData
  if (data.version !== 1) {
    throw new Error(`Unsupported export version: ${data.version}`)
  }

  return data
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
  return gists.filter((g) => g.files['aoc-livestore-export.json'])
}
