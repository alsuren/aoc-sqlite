import { type JSX, type ParentComponent, Show } from 'solid-js'

// Store collapsed state in localStorage
const COLLAPSED_KEY = 'aoc-sqlite-collapsed'

function getCollapsedState(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function setCollapsedState(key: string, collapsed: boolean) {
  const state = getCollapsedState()
  state[key] = collapsed
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify(state))
}

export function isCollapsed(key: string, defaultCollapsed = false): boolean {
  const state = getCollapsedState()
  return state[key] ?? defaultCollapsed
}

export function toggleCollapsed(
  key: string,
  defaultCollapsed = false,
): boolean {
  const current = isCollapsed(key, defaultCollapsed)
  setCollapsedState(key, !current)
  return !current
}

interface CollapsibleSectionProps {
  id: string
  title: JSX.Element
  defaultCollapsed?: boolean
  collapsed: boolean
  onToggle: () => void
}

export const CollapsibleSection: ParentComponent<CollapsibleSectionProps> = (
  props,
) => {
  return (
    <div class={`collapsible-section ${props.collapsed ? 'collapsed' : ''}`}>
      <h2 class="collapsible-header">
        <button
          type="button"
          onClick={props.onToggle}
          aria-expanded={!props.collapsed}
        >
          <span class="chevron">{props.collapsed ? '▶' : '▼'}</span>
          {props.title}
        </button>
      </h2>
      <Show when={!props.collapsed}>
        <div class="collapsible-content">{props.children}</div>
      </Show>
    </div>
  )
}
