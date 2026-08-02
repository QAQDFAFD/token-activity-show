/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, parseThemePreference, readThemePreference, saveThemePreference, subscribeToSystemTheme, THEME_STORAGE_KEY } from '../../src/renderer/src/theme'

afterEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); vi.restoreAllMocks() })
function media(matches: boolean) {
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches, addEventListener: (_: string, listener: () => void) => listeners.add(listener), removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) })))
  return listeners
}

describe('theme', () => {
  it('falls back to system for missing and invalid preferences', () => {
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference('sepia')).toBe('system')
    expect(readThemePreference()).toBe('system')
  })
  it('persists and applies explicit themes', () => {
    media(false)
    saveThemePreference('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
  it('resolves and follows system appearance only in system mode', () => {
    const listeners = media(true)
    expect(applyTheme('system')).toBe('dark')
    const listener = vi.fn()
    const dispose = subscribeToSystemTheme('system', listener)
    listeners.forEach((notify) => notify())
    expect(listener).toHaveBeenCalledWith('dark')
    dispose()
    expect(listeners.size).toBe(0)
    subscribeToSystemTheme('light', listener)
    expect(listeners.size).toBe(0)
  })
})
