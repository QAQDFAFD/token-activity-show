import type { ThemePreference } from '../theme'

const options: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '系统' },
  { value: 'light', label: '日间' },
  { value: 'dark', label: '暗夜' }
]

export function ThemeControl({ value, onChange }: { value: ThemePreference; onChange(value: ThemePreference): void }): React.JSX.Element {
  return (
    <div className="theme-control">
      <span id="theme-label">外观</span>
      <div aria-labelledby="theme-label" className="theme-options" role="group">
        {options.map((option) => (
          <button aria-pressed={value === option.value} key={option.value} onClick={() => onChange(option.value)} type="button">{option.label}</button>
        ))}
      </div>
    </div>
  )
}
