export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'token-activity-show:theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system'
}

export function readThemePreference(): ThemePreference {
  return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark = window.matchMedia(DARK_QUERY).matches
): ResolvedTheme {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference)
  document.documentElement.dataset['theme'] = resolved
  document.documentElement.style.colorScheme = resolved
  return resolved
}

export function saveThemePreference(preference: ThemePreference): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  applyTheme(preference)
}

export function subscribeToSystemTheme(
  preference: ThemePreference,
  listener: (theme: ResolvedTheme) => void
): () => void {
  if (preference !== 'system') return () => undefined
  const media = window.matchMedia(DARK_QUERY)
  const handleChange = (): void => listener(applyTheme('system'))
  media.addEventListener('change', handleChange)
  return () => media.removeEventListener('change', handleChange)
}
