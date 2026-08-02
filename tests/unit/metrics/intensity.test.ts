import { describe, expect, it } from 'vitest'
import { calculateIntensity, type IntensityDay } from '../../../src/main/metrics/intensity'

const day = (date: string, sessionCount: number, interactionCount: number | null = null, tokenUsage: number | null = null, activeDurationSeconds: number | null = null): IntensityDay => ({
  date, sessionCount, interactionCount, tokenUsage, activeDurationSeconds
})

describe('calculateIntensity', () => {
  it('reports cold-start states from effective use days', () => {
    expect(calculateIntensity({ today: day('2026-08-02', 1), history: [day('2026-08-01', 1)] }).status).toBe('insufficient-data')
    expect(calculateIntensity({ today: day('2026-08-02', 2), history: [1, 2, 3].map((n) => day(`2026-07-0${n}`, n)) }).status).toBe('preliminary')
    expect(calculateIntensity({ today: day('2026-08-02', 2), history: [1, 2, 3, 4, 5, 6, 7].map((n) => day(`2026-07-${String(n).padStart(2, '0')}`, n)) }).status).toBe('established')
  })

  it('redistributes missing metric weights without treating unknown as zero', () => {
    const result = calculateIntensity({
      today: day('2026-08-02', 4, 8),
      history: [1, 2, 3, 4, 5, 6, 7].map((n) => day(`2026-07-${String(n).padStart(2, '0')}`, 2, 4))
    })

    expect(result.availableMetrics).toEqual(['interactions', 'sessions'])
    expect(result.score).not.toBeNaN()
    expect(result.score).toBeGreaterThan(50)
  })

  it('uses a robust baseline so one outlier does not dominate', () => {
    const normal = [9, 10, 10, 11, 10, 9]
    const result = calculateIntensity({
      today: day('2026-08-02', 12),
      history: [...normal, 1000].map((value, index) => day(`2026-07-${String(index + 1).padStart(2, '0')}`, value))
    })

    expect(result.score).toBeGreaterThan(50)
    expect(result.band).not.toBe('very-low')
  })

  it('keeps zero-activity days in context but excludes them from effective-use count', () => {
    const result = calculateIntensity({
      today: day('2026-08-02', 0),
      history: [day('2026-07-30', 2), day('2026-07-31', 0), day('2026-08-01', 3)]
    })

    expect(result.contextDays).toBe(3)
    expect(result.effectiveUseDays).toBe(2)
    expect(result.status).toBe('insufficient-data')
    expect(Number.isFinite(result.score)).toBe(true)
  })
})
