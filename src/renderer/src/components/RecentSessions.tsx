import type { NormalizedSession } from '../../../shared/domain'

const providerNames = { 'claude-code': 'Claude Code', codex: 'Codex', hermes: 'Hermes' } as const

export function RecentSessions({ sessions }: { sessions: readonly NormalizedSession[] }): React.JSX.Element {
  if (sessions.length === 0) return <></>
  return (
    <section className="panel" aria-labelledby="sessions-title">
      <div className="panel-heading"><h2 id="sessions-title">最近会话</h2><span>最多显示 10 个</span></div>
      <div className="session-list">
        {sessions.map((session) => (
          <article className="session-row" key={session.id}>
            <div><strong>{session.projectName ?? '未命名项目'}</strong><span>{providerNames[session.providerId]}{session.model ? ` · ${session.model}` : ''}</span></div>
            <time dateTime={session.updatedAt}>{new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(session.updatedAt))}</time>
          </article>
        ))}
      </div>
    </section>
  )
}
