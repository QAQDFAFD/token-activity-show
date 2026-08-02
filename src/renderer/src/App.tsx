import { useEffect, useState } from 'react'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import { ThemeControl } from './components/ThemeControl'
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
      <aside className="sidebar"><div className="brand"><strong>Token Activity Show</strong><small>Activity on this Mac</small></div><nav aria-label="主导航"><a aria-current={route === 'today' ? 'page' : undefined} href="#/today">Today</a><a aria-current={route === 'settings' ? 'page' : undefined} href="#/settings">Settings</a></nav><div className="sidebar-tools"><ThemeControl onChange={changeTheme} value={theme} /><div className="sidebar-footer"><span>数据仅保存在本机</span></div></div></aside>
      <main className="main-view">{route === 'settings' ? <SettingsPage /> : <TodayPage />}</main>
    </div>
  )
}
