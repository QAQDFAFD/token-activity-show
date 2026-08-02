const sources = ['Claude Code', 'Codex', 'Hermes'] as const

export function EmptyState(): React.JSX.Element {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <header>
        <h2 id="empty-title">等待本地活动</h2>
        <p>会话格式尚未建立。应用只展示能够验证的数据，不会猜测字段或将未知值记为零。</p>
      </header>
      <div className="source-status-list" aria-label="来源状态">
        {sources.map((source) => (
          <div key={source}>
            <strong>{source}</strong>
            <span>格式尚未建立</span>
          </div>
        ))}
      </div>
      <p className="format-note">当前状态：<code>FORMAT_NOT_ESTABLISHED</code></p>
    </section>
  )
}
