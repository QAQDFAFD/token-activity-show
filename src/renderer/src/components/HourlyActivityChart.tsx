import { useState } from 'react'
import type { HourlyActivity } from '../../../shared/domain'
import { PROVIDER_IDS } from '../../../shared/domain'
import { useI18n } from '../i18n'
import { providerPresentation } from '../provider-presentation'

function barAriaLabel(bucket: HourlyActivity, labels: { unavailable: string; total: string }, hourText: string): string {
  const parts = PROVIDER_IDS.map((providerId) => {
    const count = bucket.byProvider[providerId]
    const label = providerPresentation(providerId).label
    return count === null ? `${label} ${labels.unavailable}` : `${label} ${count}`
  })
  const total = bucket.totalInteractions === null ? labels.unavailable : String(bucket.totalInteractions)
  return `${hourText}, ${labels.total} ${total} (${parts.join(', ')})`
}

export function HourlyActivityChart({ activity }: { activity: readonly HourlyActivity[] }): React.JSX.Element {
  const { t } = useI18n()
  const [activeHour, setActiveHour] = useState<number | null>(null)
  const labels = { unavailable: t('unavailable'), total: t('hourlyTotal') }
  const hourText = (hour: number) => t('hourLabel', { hour: String(hour) })

  if (activity.length !== 24 || activity.every((bucket) => bucket.totalInteractions === null)) {
    return <section className="panel" aria-labelledby="hourly-title"><div className="panel-heading"><h2 id="hourly-title">{t('hourlyActivity')}</h2></div><p className="hourly-unavailable">{t('hourlyUnavailableState')}</p><p className="muted">{t('hourlyUnavailableDescription')}</p></section>
  }

  const max = Math.max(1, ...activity.map((bucket) => bucket.totalInteractions ?? 0))
  const detail = activeHour === null ? null : (activity[activeHour] ?? null)
  const rows = PROVIDER_IDS.map((providerId) => providerPresentation(providerId))
  const legend = rows.map((presentation) => <span className="legend-item" key={presentation.className}><i className={`legend-swatch ${presentation.className}`} aria-hidden="true" />{presentation.label}</span>)

  const bars = activity.map((bucket) => {
    const total = bucket.totalInteractions ?? 0
    const segments = PROVIDER_IDS.flatMap((providerId) => {
      const count = bucket.byProvider[providerId]
      if (count === null || count === 0) return []
      const presentation = providerPresentation(providerId)
      return <span key={providerId} className={`segment ${presentation.className}`} style={{ height: `${(count / max) * 100}%` }} />
    })
    return <div key={bucket.hour} role="img" tabIndex={0} className={`hourly-bar${bucket.totalInteractions === null ? ' hourly-bar--unknown' : ''}`} aria-label={barAriaLabel(bucket, labels, hourText(bucket.hour))} onFocus={() => setActiveHour(bucket.hour)} onBlur={() => setActiveHour(null)} onMouseEnter={() => setActiveHour(bucket.hour)} onMouseLeave={() => setActiveHour(null)}><div className="hourly-bar-fill">{segments.length > 0 ? segments : <span className="hourly-bar-zero" aria-hidden="true" />}</div><span className="hourly-bar-label" aria-hidden="true">{bucket.hour}</span></div>
  })

  const detailText = detail === null ? <p className="hourly-detail-empty">{t('hourlyFocusHint')}</p> : <><strong>{hourText(detail.hour)}</strong><span>{detail.totalInteractions === null ? t('hourlyNoData') : `${t('hourlyTotal')} ${detail.totalInteractions}`}</span><span className="hourly-detail-providers">{PROVIDER_IDS.map((providerId) => { const count = detail.byProvider[providerId]; return <span key={providerId} className={providerPresentation(providerId).className}>{providerPresentation(providerId).label} {count === null ? t('unavailable') : count}</span> })}</span></>

  const table = <table className="hourly-table"><caption>{t('hourlyTableCaption')}</caption><thead><tr><th scope="col">{t('hourLabel')}</th>{rows.map((presentation) => <th scope="col" key={presentation.className}>{presentation.label}</th>)}<th scope="col">{t('hourlyTotal')}</th></tr></thead><tbody>{activity.map((bucket) => <tr key={bucket.hour}><th scope="row">{bucket.hour}:00</th>{PROVIDER_IDS.map((providerId) => { const count = bucket.byProvider[providerId]; return <td key={providerId}>{count === null ? t('unavailable') : count}</td> })}<td>{bucket.totalInteractions === null ? t('unavailable') : bucket.totalInteractions}</td></tr>)}</tbody></table>

  return <section className="panel hourly-panel" aria-labelledby="hourly-title"><div className="panel-heading"><h2 id="hourly-title">{t('hourlyActivity')}</h2><span className="hourly-legend" aria-label={t('hourlyLegendA11y')}>{legend}</span></div><div className="hourly-chart" role="group" aria-label={t('hourlyChartA11y')}><div className="hourly-bars">{bars}</div><div className="hourly-detail" aria-live="polite">{detailText}</div></div><details className="hourly-table-toggle"><summary>{t('hourlyTableView')}</summary>{table}</details></section>
}
