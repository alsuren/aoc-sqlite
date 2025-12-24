// Get the latest AoC year (current year if Nov/Dec, otherwise previous year)
export const getLatestAocYear = () => {
  const now = new Date()
  const month = now.getMonth() // 0-indexed: 10 = November, 11 = December
  const year = now.getFullYear()
  return month >= 10 ? year : year - 1
}

export type UrlState = {
  year: number
  day: number
  part: 1 | 2
}

// Parse URL hash like #/2024/5/1 -> { year: 2024, day: 5, part: 1 }
export const parseUrlHash = (): UrlState | null => {
  const hash = window.location.hash
  const match = hash.match(/^#\/(\d{4})\/(\d{1,2})\/([12])$/)
  if (!match) return null

  const year = parseInt(match[1], 10)
  const day = parseInt(match[2], 10)
  const part = parseInt(match[3], 10) as 1 | 2

  // Validate ranges
  if (year < 2015 || year > getLatestAocYear()) return null
  if (day < 1 || day > 25) return null

  return { year, day, part }
}

// Update URL hash to reflect current state
export const updateUrlHash = (year: number, day: number, part: 1 | 2) => {
  const newHash = `#/${year}/${day}/${part}`
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', newHash)
  }
}
