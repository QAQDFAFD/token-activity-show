import { useEffect, useState } from 'react'
import type { AppSettings } from '../../../shared/api'
import type { ProviderId } from '../../../shared/domain'
import type { UpdateSettingsInput } from '../../../shared/schemas'
import { getRendererApi } from '../api'

const providers: readonly { id: ProviderId; name: string; description: string }[] = [
  { id: 'claude-code', name: 'Claude Code', description: 'Anthropic 本地编码会话' },
  { id: 'codex', name: 'Codex', description: 'OpenAI Codex 本地会话' },
  { id: 'hermes', name: 'Hermes', description: 'Nous Research Hermes Agent' }
]
const intervals = [0, 5, 10, 15, 30, 60] as const

export function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => { void getRendererApi().getSettings().then((result) => { if (result.ok) setSettings(result.value); else { setStatus('error'); setMessage(result.error.message) } }) }, [])
  if (!settings) return <div className="page-state" role="status"><div className="skeleton skeleton-title" /><span>{status === 'error' ? message : '正在加载设置…'}</span></div>

  const toggle = (providerId: ProviderId): void => setSettings({ ...settings, enabledSources: { ...settings.enabledSources, [providerId]: !settings.enabledSources[providerId] } })
  const save = async (): Promise<void> => {
    setStatus('saving')
    const result = await getRendererApi().updateSettings(settings as UpdateSettingsInput)
    if (result.ok) { setSettings(result.value); setStatus('saved'); setMessage('设置已保存') } else { setStatus('error'); setMessage(result.error.message) }
  }

  return (
    <div className="page-content settings-page">
      <header className="page-header"><div><p className="section-label">偏好设置</p><h1>设置</h1><p>管理本地来源和应用运行期间的刷新频率。</p></div></header>
      <section className="panel" aria-labelledby="sources-heading"><div className="panel-heading"><div><h2 id="sources-heading">活动来源</h2><p>关闭来源后，后续刷新将跳过该来源。</p></div></div><div className="settings-list">{providers.map((provider) => <label className="source-option" key={provider.id}><span><strong>{provider.name}</strong><small>{provider.description}</small></span><input aria-label={`启用 ${provider.name}`} checked={settings.enabledSources[provider.id]} onChange={() => toggle(provider.id)} type="checkbox" /><i aria-hidden="true" /></label>)}</div></section>
      <section className="panel" aria-labelledby="refresh-heading"><div className="panel-heading"><div><h2 id="refresh-heading">自动刷新</h2><p>自动刷新仅在 Token Activity Show 打开时运行。</p></div></div><label className="field"><span>刷新间隔</span><select aria-label="刷新间隔" value={settings.refreshIntervalMinutes} onChange={(event) => setSettings({ ...settings, refreshIntervalMinutes: Number(event.target.value) })}>{intervals.map((interval) => <option key={interval} value={interval}>{interval === 0 ? '关闭自动刷新' : `每 ${interval} 分钟`}</option>)}</select></label></section>
      <section className="future-panel"><div><strong>分析模型与隐私控制</strong><p>活动摘要、模型配置和高级隐私控制将在后续版本提供。</p></div><span>计划中</span></section>
      <div className="save-bar"><span className={status === 'error' ? 'status-error' : ''} role="status">{message}</span><button className="primary-button" disabled={status === 'saving'} onClick={() => void save()} type="button">{status === 'saving' ? '正在保存…' : '保存设置'}</button></div>
    </div>
  )
}
