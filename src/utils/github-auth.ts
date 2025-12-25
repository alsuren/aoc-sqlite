// GitHub Device Authorization Flow
// https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow

// You'll need to create a GitHub OAuth App and set this Client ID
// Create one at: https://github.com/settings/applications/new
// - Set "Device flow" to enabled in the app settings
const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || ''

const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const USER_URL = 'https://api.github.com/user'

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token: string
  token_type: string
  scope: string
}

export interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
}

export interface AuthState {
  token: string | null
  user: GitHubUser | null
}

const TOKEN_KEY = 'aoc-livestore-github-token'
const USER_KEY = 'aoc-livestore-github-user'

/**
 * Get stored auth state from localStorage
 */
export function getStoredAuth(): AuthState {
  const token = localStorage.getItem(TOKEN_KEY)
  const userJson = localStorage.getItem(USER_KEY)
  const user = userJson ? (JSON.parse(userJson) as GitHubUser) : null
  return { token, user }
}

/**
 * Save auth state to localStorage
 */
export function saveAuth(token: string, user: GitHubUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/**
 * Clear auth state
 */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * Check if GitHub OAuth is configured
 */
export function isOAuthConfigured(): boolean {
  return Boolean(CLIENT_ID)
}

/**
 * Start the device authorization flow
 * Returns the device code info for the user to enter
 */
export async function startDeviceFlow(): Promise<DeviceCodeResponse> {
  if (!CLIENT_ID) {
    throw new Error('GitHub OAuth Client ID not configured')
  }

  const response = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      scope: 'gist',
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to start device flow: ${response.status}`)
  }

  return response.json()
}

/**
 * Poll for the access token after user authorizes
 * Returns null if still pending, throws on error
 */
export async function pollForToken(
  deviceCode: string,
): Promise<TokenResponse | null> {
  if (!CLIENT_ID) {
    throw new Error('GitHub OAuth Client ID not configured')
  }

  const response = await fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to poll for token: ${response.status}`)
  }

  const data = await response.json()

  // Check for pending/error states
  if (data.error) {
    switch (data.error) {
      case 'authorization_pending':
        // User hasn't authorized yet, keep polling
        return null
      case 'slow_down':
        // Need to slow down polling (handled by caller)
        return null
      case 'expired_token':
        throw new Error('Authorization expired. Please try again.')
      case 'access_denied':
        throw new Error('Authorization was denied.')
      default:
        throw new Error(data.error_description || data.error)
    }
  }

  return data as TokenResponse
}

/**
 * Fetch the authenticated user's info
 */
export async function fetchUser(token: string): Promise<GitHubUser> {
  const response = await fetch(USER_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`)
  }

  return response.json()
}

/**
 * Complete device flow with polling
 * Calls onPending with user code, polls until authorized or expired
 */
export async function completeDeviceFlow(
  onPending: (userCode: string, verificationUri: string) => void,
  onPolling: () => void,
): Promise<AuthState> {
  const deviceInfo = await startDeviceFlow()

  // Show the user code to the user
  onPending(deviceInfo.user_code, deviceInfo.verification_uri)

  // Poll for token
  const expiresAt = Date.now() + deviceInfo.expires_in * 1000
  let interval = deviceInfo.interval * 1000

  while (Date.now() < expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, interval))
    onPolling()

    try {
      const tokenResponse = await pollForToken(deviceInfo.device_code)
      if (tokenResponse) {
        // Got the token! Fetch user info
        const user = await fetchUser(tokenResponse.access_token)
        saveAuth(tokenResponse.access_token, user)
        return { token: tokenResponse.access_token, user }
      }
    } catch (error) {
      // If it's a slow_down error, increase interval
      if (error instanceof Error && error.message.includes('slow_down')) {
        interval += 5000
      } else {
        throw error
      }
    }
  }

  throw new Error('Authorization timed out. Please try again.')
}
