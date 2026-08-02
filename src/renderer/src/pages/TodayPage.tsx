import { useCallback, useEffect, useState } from 'react'
import type { RefreshState, TodayViewModel } from '../../../shared/api'
import { getRendererApi } from '../api'
import { EmptyState } from '../components/EmptyState'
import { IntensityHeader } from '../components/IntensityHeader'
import { ProviderActivityList } from '../components/ProviderActivityList'
import { RecentSessions } from '../components/RecentSessions'
import { RefreshButton } from '../components/RefreshButton'

function todayInput(): { localDate: string; timeZone: string } {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { localDate: `${values['year']}-${values['month']}-${values['day']}`, timeZone }
}

const value = (metric: number | null | undefined, suffix = ''): string => metric == null ? '不可用' : `${metric.toLocaleString()}${suffix}`

export function TodayPage(): React.JSX.Element {
  const [today, setToday] = useState<TodayViewModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshState, setRefreshState] = useState<RefreshState>({ status: 'idle' })

  const load = useCallback(async () => {
    const result = await getRendererApi().getToday(todayInput())
    if (result.ok) { setToday(result.value); setError(null) } else setError(result.error.message)
    setLoading(false)
  }, [])

  useEffect(() => {
    void getRendererApi().getToday(todayInput()).then((result) => {
      if (result.ok) {
        setToday(result.value)
        setError(null)
      } else {
        setError(result.error.message)
      }
      setLoading(false)
    })
    return getRendererApi().onRefreshState(setRefreshState)
  }, [])

  const refresh = async (): Promise<void> => {
    setRefreshState({ status: 'scanning' })
    const result = await getRendererApi().refreshNow()
    if (!result.ok || result.value.status === 'failed') {
      const message = !result.ok
        ? result.error.message
        : result.value.status === 'failed'
          ? result.value.reason
          : '刷新失败'
      setError(message)
      setRefreshState({ status: 'failed' })
      return
    }
    await load()
  }

  if (loading) return <div className="page-state" role="status"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-card" /><span>正在加载今日活动…</span></div>
  if (!today) return <div className="page-state"><h1>无法加载活动</h1><p>{error}</p><button className="primary-button" onClick={() => void load()} type="button">重试</button></div>

  const overall = today.overall
  const providers = today.providers ?? []
  return (
    <div className="page-content">
      <header className="page-header"><div><p className="section-label">{today.localDate ?? '今天'}</p><h1>今日活动</h1><p>{today.coveredAt ? `数据覆盖至 ${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(today.coveredAt))}` : '本地统计'}</p></div><RefreshButton refreshing={refreshState.status === 'scanning'} onRefresh={() => void refresh()} /></header>
      {error && <div className="error-banner" role="alert"><strong>刷新未完成</strong><span>{error}，已保留上次成功的数据。</span></div>}
      {overall && overall.sessionCount > 0 && today.intensity ? <>
        <IntensityHeader intensity={today.intensity} />
        <section className="metric-grid" aria-label="今日汇总">
          <article><span>原生会话</span><strong>{overall.sessionCount}</strong><small>今日开始的会话</small></article>
          <article><span>有效交互</span><strong>{value(overall.interactionCount)}</strong><small>真实用户请求</small></article>
          <article><span>Token 用量</span><strong>{value(overall.tokenUsage)}</strong><small>仅在来源支持时显示</small></article>
          <article><span>活跃时长</span><strong>{value(overall.activeDurationSeconds, ' 秒')}</strong><small>不估算缺失数据</small></article>
        </section>
        <ProviderActivityList providers={providers} />
        <RecentSessions sessions={today.recentSessions ?? []} />
      </> : <EmptyState />}
      <aside className="notice"><strong>Statistics-only 模式</strong><p>活动摘要将在后续版本支持分析模型后生成。当前页面只展示本地、客观且可验证的统计数据。</p></aside>
    </div>
  )
}
