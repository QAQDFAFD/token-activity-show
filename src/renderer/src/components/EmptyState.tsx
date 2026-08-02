export function EmptyState(): React.JSX.Element {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div><h2 id="empty-title">还没有可展示的活动</h2><p>Claude Code、Codex 和 Hermes 的本地会话格式尚未建立。Token Activity Show 不会猜测格式，也不会把未知指标显示为零。当前来源状态为 <code>FORMAT_NOT_ESTABLISHED</code>。</p></div>
    </section>
  )
}
