import { useI18n } from '../i18n'
import type { ThemePreference } from '../theme'

const options: readonly { value: ThemePreference; key: 'system' | 'light' | 'dark' }[] = [
  { value: 'system', key: 'system' },
  { value: 'light', key: 'light' },
  { value: 'dark', key: 'dark' }
]

export function ThemeControl({ value, onChange }: { value: ThemePreference; onChange(value: ThemePreference): void }): React.JSX.Element {
  const { t } = useI18n()
  return <div className="theme-control"><span id="theme-label">{t('appearance')}</span><div aria-labelledby="theme-label" className="theme-options" role="group">{options.map((option) => <button aria-pressed={value === option.value} key={option.value} onClick={() => onChange(option.value)} type="button">{t(option.key)}</button>)}</div></div>
}
