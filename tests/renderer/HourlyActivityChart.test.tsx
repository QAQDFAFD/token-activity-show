/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { HourlyActivity } from '../../src/shared/domain'
import { HourlyActivityChart } from '../../src/renderer/src/components/HourlyActivityChart'
import { I18nProvider, createI18n } from '../../src/renderer/src/i18n'

function buckets(overrides: Partial<Record<number, Partial<HourlyActivity>>> = {}): HourlyActivity[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    totalInteractions: null,
    byProvider: { 'claude-code': null, codex: null, hermes: null },
    ...overrides[hour]
  }))
}

function renderChart(activity: readonly HourlyActivity[]): void {
  render(
    <I18nProvider value={createI18n('zh-CN')}>
      <HourlyActivityChart activity={activity} />
    </I18nProvider>
  )
}

afterEach(cleanup)

describe('HourlyActivityChart', () => {
  it('shows an explicit unavailable state when no provider has event-level data', () => {
    renderChart(buckets())

    expect(screen.getByText('暂无每小时活动')).toBeTruthy()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('renders 24 accessible bars with legend and table fallback', () => {
    const activity = buckets({
      8: {
        totalInteractions: 3,
        byProvider: { 'claude-code': 2, codex: 1, hermes: null }
      }
    })
    renderChart(activity)

    const bars = screen.getAllByRole('img', { hidden: false })
    expect(bars).toHaveLength(24)
    const hour8 = bars.find((bar) => bar.getAttribute('aria-label')?.includes('8:00'))
    expect(hour8?.getAttribute('aria-label')).toContain('总计 3')
    expect(hour8?.getAttribute('aria-label')).toContain('Claude Code 2')
    expect(hour8?.getAttribute('aria-label')).toContain('Codex 1')
    expect(hour8?.getAttribute('aria-label')).toContain('Hermes 不可用')

    for (const label of ['Claude Code', 'Codex', 'Hermes']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(screen.getAllByText('Claude Code', { selector: '.legend-item' }).length).toBe(1)

    fireEvent.click(screen.getByText('以表格查看数据'))
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0)
    expect(screen.getByText('8:00')).toBeTruthy()
    expect(document.querySelector('.hourly-table')?.textContent).toContain('不可用')
  })

  it('exposes zero hours and known-zero providers as accessible zeros', () => {
    const activity = buckets({
      2: { totalInteractions: 0, byProvider: { 'claude-code': 0, codex: 0, hermes: null } }
    })
    renderChart(activity)

    const hour2 = screen.getAllByRole('img', { hidden: false }).find((bar) => bar.getAttribute('aria-label')?.includes('2:00'))
    expect(hour2?.getAttribute('aria-label')).toContain('总计 0')
    expect(hour2?.getAttribute('aria-label')).toContain('Claude Code 0')
  })

  it('shows focus and hover details for the active hour', () => {
    const activity = buckets({
      14: { totalInteractions: 5, byProvider: { 'claude-code': 3, codex: 0, hermes: 2 } }
    })
    renderChart(activity)

    const hour14 = screen.getAllByRole('img', { hidden: false }).find((bar) => bar.getAttribute('aria-label')?.includes('14:00'))
    expect(hour14).toBeDefined()
    if (hour14 === undefined) throw new Error('Expected an hour 14 bar')
    fireEvent.focus(hour14)

    const detail = document.querySelector('.hourly-detail')
    expect(detail?.textContent).toContain('14:00')
    expect(detail?.textContent).toContain('总计 5')
    expect(detail?.textContent).toContain('Hermes 2')
  })
})
