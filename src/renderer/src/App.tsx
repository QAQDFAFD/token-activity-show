import { useEffect, useState } from 'react'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'

type Route = 'today' | 'settings'

function currentRoute(): Route {
  return window.location.hash === '#/settings' ? 'settings' : 'today'
}

export function App(): React.JSX.Element {
  const [route, setRoute] = useState<Route>(currentRoute)
  useEffect(() => {
    const update = (): void => setRoute(currentRoute())
    window.addEventListener('hashchange', update)
    if (!window.location.hash) window.location.hash = '#/today'
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return (
    <div className="app-shell">
      <aside className="sidebar"><div className="brand"><span aria-hidden="true">TS</span><div><strong>Token Show</strong><small>本地活动</small></div></div><nav aria-label="主导航"><a aria-current={route === 'today' ? 'page' : undefined} href="#/today"><span aria-hidden="true">⌁</span>Today</a><a aria-current={route === 'settings' ? 'page' : undefined} href="#/settings"><span aria-hidden="true">⚙</span>Settings</a></nav><div className="sidebar-footer"><strong>Statistics-only</strong><span>所有数据保存在本机</span></div></aside>
      <main className="main-view">{route === 'settings' ? <SettingsPage /> : <TodayPage />}</main>
    </div>
  )
}
