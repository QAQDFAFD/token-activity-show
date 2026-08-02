export function EmptyState(): React.JSX.Element {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-symbol" aria-hidden="true">TS</div>
      <div><h2 id="empty-title">还没有可展示的活动</h2><p>Claude Code、Codex 和 Hermes 的本地会话格式尚未建立。Token Show 不会猜测格式，也不会把未知指标显示为零。</p><span>来源状态：FORMAT_NOT_ESTABLISHED</span></div>
    </section>
  )
}
