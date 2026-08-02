/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RendererApi, TodayViewModel } from '../../src/shared/api'
import { TodayPage } from '../../src/renderer/src/pages/TodayPage'

const today: TodayViewModel = {
  summary: null, localDate: '2026-08-02', timeZone: 'Asia/Shanghai', coveredAt: '2026-08-02T08:00:00.000Z', refreshState: { status: 'idle' },
  overall: { sessionCount: 2, interactionCount: null, tokenUsage: null, activeDurationSeconds: null },
  providers: [{ providerId: 'codex', sessionCount: 2, interactionCount: null, tokenUsage: null, activeDurationSeconds: null }],
  recentSessions: [], intensity: { status: 'insufficient-data', comparison: 'provisional', score: 50, band: 'normal', explanation: '需要至少 3 个有效使用日才能建立初步基线。' },
  metricAvailability: { interactions: false, tokens: false, activeDuration: false }, precisionExplanation: '会话归属开始日期。'
}
function api(overrides: Partial<RendererApi> = {}): RendererApi {
  return { getToday: vi.fn(async () => ({ ok: true, value: today })), refreshNow: vi.fn(async () => ({ ok: true, value: { status: 'complete', trigger: 'manual', providers: 1, succeeded: 1, failed: 0, inserted: 0, updated: 0, unchanged: 2, warnings: 0 } })), getSettings: vi.fn(), updateSettings: vi.fn(), onRefreshState: vi.fn(() => () => undefined), ...overrides }
}
afterEach(cleanup)

describe('TodayPage', () => {
  it('renders objective counts and unavailable metrics', async () => {
    window.tokenActivityShow = api()
    render(<TodayPage />)
    expect(await screen.findByText('历史数据不足')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getAllByText('不可用').length).toBeGreaterThan(2)
    expect(screen.queryByText(/Users\/|工作目录/)).toBeNull()
  })
  it('renders an honest unsupported empty state', async () => {
    window.tokenActivityShow = api({ getToday: vi.fn(async () => ({ ok: true, value: { ...today, overall: { ...today.overall!, sessionCount: 0 }, providers: [] } })) })
    render(<TodayPage />)
    expect(await screen.findByText('等待本地活动')).toBeTruthy()
    expect(screen.getByText(/FORMAT_NOT_ESTABLISHED/)).toBeTruthy()
  })
  it('refreshes once and preserves data after failure', async () => {
    const refreshNow = vi.fn(async () => ({ ok: false as const, error: { code: 'INTERNAL_ERROR' as const, message: '扫描失败' } }))
    window.tokenActivityShow = api({ refreshNow })
    render(<TodayPage />)
    await screen.findByText('历史数据不足')
    fireEvent.click(screen.getByRole('button', { name: '立即刷新' }))
    await waitFor(() => expect(refreshNow).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/扫描失败/)).toBeTruthy()
    expect(screen.getByText('历史数据不足')).toBeTruthy()
  })
})
