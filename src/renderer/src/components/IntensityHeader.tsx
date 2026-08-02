import type { TodayIntensity } from '../../../shared/api'
import { useI18n } from '../i18n'

export function IntensityHeader({ intensity }: { intensity: TodayIntensity }): React.JSX.Element {
  const { t } = useI18n()
  const status = { 'insufficient-data': t('insufficient'), preliminary: t('preliminary'), established: t('established') }[intensity.status]
  const band = { 'very-low': t('veryLow'), low: t('low'), normal: t('normal'), high: t('high'), 'very-high': t('veryHigh') }[intensity.band]
  const explanation = intensity.status === 'insufficient-data' ? t('insufficientExplanation') : t('provisionalExplanation')
  return <section className="intensity-panel" aria-labelledby="intensity-title"><div><p className="section-label">{t('intensity')}</p><h2 id="intensity-title">{status}</h2><p className="muted">{explanation}</p></div><div className="intensity-score" aria-label={t('intensityA11y',{score:intensity.score,band})}><strong>{intensity.score}</strong><span>{band} · {t('provisional')}</span></div></section>
}
