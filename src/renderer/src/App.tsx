import { useEffect, useState } from 'react'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import { ThemeControl } from './components/ThemeControl'
import { useI18n } from './i18n'
import {
  applyTheme,
  readThemePreference,
  saveThemePreference,
  subscribeToSystemTheme,
  type ThemePreference
} from './theme'

type Route = 'today' | 'settings'

function currentRoute(): Route {
  return window.location.hash === '#/settings' ? 'settings' : 'today'
}

export function App(): React.JSX.Element {
  const { t } = useI18n()
  const [route, setRoute] = useState<Route>(currentRoute)
  const [theme, setTheme] = useState<ThemePreference>(readThemePreference)
  useEffect(() => {
    applyTheme(theme)
    return subscribeToSystemTheme(theme, () => undefined)
  }, [theme])
  const changeTheme = (preference: ThemePreference): void => {
    saveThemePreference(preference)
    setTheme(preference)
  }
  useEffect(() => {
    const update = (): void => setRoute(currentRoute())
    window.addEventListener('hashchange', update)
    if (!window.location.hash) window.location.hash = '#/today'
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return (
    <div className="app-shell">
      <aside className="sidebar"><div className="brand"><strong>Token Activity Show</strong><small>{t('localActivity')}</small></div><nav aria-label={t('mainNavigation')}><a aria-current={route === 'today' ? 'page' : undefined} href="#/today">{t('todayNav')}</a><a aria-current={route === 'settings' ? 'page' : undefined} href="#/settings">{t('settingsNav')}</a></nav><div className="sidebar-tools"><ThemeControl onChange={changeTheme} value={theme} /><div className="sidebar-footer"><span>{t('localOnly')}</span></div></div></aside>
      <main className="main-view">{route === 'settings' ? <SettingsPage /> : <TodayPage />}</main>
    </div>
  )
}
