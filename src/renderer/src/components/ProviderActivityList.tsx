import type { ProviderTodayMetrics } from '../../../shared/api'

const providerNames = { 'claude-code': 'Claude Code', codex: 'Codex', hermes: 'Hermes' } as const
const metric = (value: number | null, suffix = ''): string => value === null ? '不可用' : `${value.toLocaleString()}${suffix}`

export function ProviderActivityList({ providers }: { providers: readonly ProviderTodayMetrics[] }): React.JSX.Element {
  return (
    <section className="panel" aria-labelledby="providers-title">
      <div className="panel-heading"><h2 id="providers-title">来源活动</h2><span>{providers.length} 个活跃来源</span></div>
      <div className="provider-list">
        {providers.map((provider) => (
          <article className="provider-row" key={provider.providerId}>
            <div className="provider-name"><span className="provider-mark" aria-hidden="true">{providerNames[provider.providerId].slice(0, 1)}</span><div><strong>{providerNames[provider.providerId]}</strong><span>{provider.sessionCount} 个原生会话</span></div></div>
            <dl className="provider-metrics">
              <div><dt>交互</dt><dd>{metric(provider.interactionCount)}</dd></div>
              <div><dt>Token</dt><dd>{metric(provider.tokenUsage)}</dd></div>
              <div><dt>活跃时长</dt><dd>{metric(provider.activeDurationSeconds, ' 秒')}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  )
}
