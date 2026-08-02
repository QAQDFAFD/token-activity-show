/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RendererApi } from '../../src/shared/api'
import { SettingsPage } from '../../src/renderer/src/pages/SettingsPage'

const settings = { refreshIntervalMinutes: 10, enabledSources: { 'claude-code': true, codex: true, hermes: true } }
function api(overrides: Partial<RendererApi> = {}): RendererApi {
  return { getToday: vi.fn(), refreshNow: vi.fn(), getSettings: vi.fn(async () => ({ ok: true, value: settings })), updateSettings: vi.fn(async (input) => ({ ok: true, value: input })), onRefreshState: vi.fn(() => () => undefined), ...overrides }
}
afterEach(cleanup)

describe('SettingsPage', () => {
  it('loads, edits, and saves accepted settings', async () => {
    const updateSettings = vi.fn(async (input) => ({ ok: true as const, value: input }))
    window.tokenActivityShow = api({ updateSettings })
    render(<SettingsPage />)
    const codex = await screen.findByRole('checkbox', { name: '启用 Codex' })
    fireEvent.click(codex)
    fireEvent.change(screen.getByRole('combobox', { name: '刷新间隔' }), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ refreshIntervalMinutes: 15, enabledSources: expect.objectContaining({ codex: false }) })))
    expect(await screen.findByText('设置已保存')).toBeTruthy()
  })
  it('keeps controls available after save failure', async () => {
    window.tokenActivityShow = api({ updateSettings: vi.fn(async () => ({ ok: false, error: { code: 'INTERNAL_ERROR', message: '保存失败' } })) })
    render(<SettingsPage />)
    await screen.findByRole('checkbox', { name: '启用 Hermes' })
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))
    expect(await screen.findByText('保存失败')).toBeTruthy()
    expect((screen.getByRole('button', { name: '保存设置' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
