import type { TodayIntensity } from '../../../shared/api'

const statusLabel = {
  'insufficient-data': '历史数据不足',
  preliminary: '初步评估',
  established: '已建立基线'
} as const

const bandLabel = {
  'very-low': '非常低', low: '偏低', normal: '正常', high: '偏高', 'very-high': '非常高'
} as const

export function IntensityHeader({ intensity }: { intensity: TodayIntensity }): React.JSX.Element {
  return (
    <section className="intensity-panel" aria-labelledby="intensity-title">
      <div>
        <p className="section-label">今日强度</p>
        <h2 id="intensity-title">{statusLabel[intensity.status]}</h2>
        <p className="muted">{intensity.explanation}</p>
      </div>
      <div className="intensity-score" aria-label={`强度分数 ${intensity.score}，${bandLabel[intensity.band]}`}>
        <strong>{intensity.score}</strong>
        <span>{bandLabel[intensity.band]} · 临时</span>
      </div>
    </section>
  )
}
