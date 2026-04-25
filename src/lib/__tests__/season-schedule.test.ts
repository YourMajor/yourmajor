import { describe, it, expect } from 'vitest'
import { computeScheduleDates, DAYS_OF_WEEK } from '@/lib/season-schedule'

describe('computeScheduleDates', () => {
  it('generates N consecutive weekly dates aligned to the requested day', () => {
    // 2026-04-27 is a Monday → asking for Tuesday (dayOfWeek=2) should snap to 2026-04-28
    const dates = computeScheduleDates('2026-04-27', 2, 4)
    expect(dates).toEqual(['2026-04-28', '2026-05-05', '2026-05-12', '2026-05-19'])
  })

  it('keeps the same day when start already lands on it', () => {
    // 2026-04-28 is a Tuesday — first generated date should be itself
    const dates = computeScheduleDates('2026-04-28', 2, 3)
    expect(dates[0]).toBe('2026-04-28')
    expect(dates).toHaveLength(3)
  })

  it('skips dates listed in skipDates and keeps producing N events total', () => {
    // Ask for 4 events starting 2026-04-28 (Tue) but skip 2026-05-05.
    // Expect: 04-28, 05-12, 05-19, 05-26 (we walked past the skipped week, keeping count at 4).
    const dates = computeScheduleDates('2026-04-28', 2, 4, ['2026-05-05'])
    expect(dates).toEqual(['2026-04-28', '2026-05-12', '2026-05-19', '2026-05-26'])
  })

  it('returns empty array for invalid start date', () => {
    expect(computeScheduleDates('not-a-date', 2, 4)).toEqual([])
  })

  it('returns empty array when weeks is non-positive', () => {
    expect(computeScheduleDates('2026-04-28', 2, 0)).toEqual([])
  })

  it('caps the loop so excessive skip-dates cannot run forever', () => {
    // Ask for 2 events but skip the first 100 candidate dates → loop bound is 8 (2 * 4) so produces []
    const skipAll: string[] = []
    for (let w = 0; w < 100; w++) {
      const d = new Date('2026-04-28')
      d.setDate(d.getDate() + w * 7)
      skipAll.push(d.toISOString().slice(0, 10))
    }
    expect(computeScheduleDates('2026-04-28', 2, 2, skipAll)).toEqual([])
  })
})

describe('DAYS_OF_WEEK constant', () => {
  it('exports a 7-element label array', () => {
    expect(DAYS_OF_WEEK).toHaveLength(7)
    expect(DAYS_OF_WEEK[0]).toBe('Sun')
    expect(DAYS_OF_WEEK[6]).toBe('Sat')
  })
})
