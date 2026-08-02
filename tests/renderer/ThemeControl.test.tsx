/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeControl } from '../../src/renderer/src/components/ThemeControl'

afterEach(cleanup)

describe('ThemeControl', () => {
  it('exposes and changes all three appearance modes', () => {
    const onChange = vi.fn()
    render(<ThemeControl onChange={onChange} value="system" />)
    expect(screen.getByRole('button', { name: '系统' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '日间' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: '暗夜' }))
    expect(onChange).toHaveBeenCalledWith('dark')
  })
})
