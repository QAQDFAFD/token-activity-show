import { afterEach, describe, expect, it, vi } from 'vitest'
import { RefreshScheduler } from '../../../src/main/refresh/refresh-scheduler'

describe('RefreshScheduler', () => {
  afterEach(() => vi.useRealTimers())

  it('runs at the configured interval', async () => {
    vi.useFakeTimers()
    const refresh = vi.fn(async () => undefined)
    const scheduler = new RefreshScheduler(refresh)

    scheduler.start(10)
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)

    expect(refresh).toHaveBeenCalledOnce()
  })

  it('reschedules, disables, and stops cleanly', async () => {
    vi.useFakeTimers()
    const refresh = vi.fn(async () => undefined)
    const scheduler = new RefreshScheduler(refresh)

    scheduler.start(10)
    scheduler.reschedule(5)
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(refresh).toHaveBeenCalledOnce()

    scheduler.reschedule(0)
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(refresh).toHaveBeenCalledOnce()

    scheduler.start(5)
    scheduler.stop()
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(refresh).toHaveBeenCalledOnce()
  })
})
