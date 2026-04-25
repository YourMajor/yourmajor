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

describe('computeScheduleDates with frequency option', () => {
  it('defaults to WEEKLY when no options passed (backwards compat)', () => {
    const dates = computeScheduleDates('2026-04-27', 2, 3)
    expect(dates).toEqual(['2026-04-28', '2026-05-05', '2026-05-12'])
  })

  it('BIWEEKLY produces dates 14 days apart', () => {
    const dates = computeScheduleDates('2026-04-27', 2, 3, [], { frequency: 'BIWEEKLY' })
    expect(dates).toEqual(['2026-04-28', '2026-05-12', '2026-05-26'])
  })

  it('CUSTOM with intervalWeeks=3 produces dates 21 days apart', () => {
    const dates = computeScheduleDates('2026-04-27', 2, 3, [], {
      frequency: 'CUSTOM',
      intervalWeeks: 3,
    })
    expect(dates).toEqual(['2026-04-28', '2026-05-19', '2026-06-09'])
  })

  it('CUSTOM with intervalWeeks=1 is equivalent to WEEKLY', () => {
    const weekly = computeScheduleDates('2026-04-27', 2, 4)
    const custom = computeScheduleDates('2026-04-27', 2, 4, [], {
      frequency: 'CUSTOM',
      intervalWeeks: 1,
    })
    expect(custom).toEqual(weekly)
  })

  it('MONTHLY produces the same nth weekday each month', () => {
    // 2026-04-28 is the 4th Tuesday of April (week of: 7, 14, 21, 28).
    // Monthly should return 4th Tuesday of April, May, June.
    const dates = computeScheduleDates('2026-04-28', 2, 3, [], { frequency: 'MONTHLY' })
    expect(dates).toEqual(['2026-04-28', '2026-05-26', '2026-06-23'])
  })

  it('MONTHLY snaps the first event forward to dayOfWeek if start is not on it', () => {
    // 2026-04-15 is a Wednesday. Asking for Saturday → first occurrence 2026-04-18 (3rd Saturday).
    // Then May 3rd Saturday = 2026-05-16, June = 2026-06-20.
    const dates = computeScheduleDates('2026-04-15', 6, 3, [], { frequency: 'MONTHLY' })
    expect(dates[0]).toBe('2026-04-18')
    expect(dates[1]).toBe('2026-05-16')
    expect(dates[2]).toBe('2026-06-20')
  })

  it('MONTHLY falls back to last weekday when the nth does not exist that month', () => {
    // 2026-01-31 is a Saturday and the 5th Saturday of January.
    // February 2026 has 28 days and only 4 Saturdays — 5th would be March, so we should fall back to Feb 28.
    const dates = computeScheduleDates('2026-01-31', 6, 2, [], { frequency: 'MONTHLY' })
    expect(dates[0]).toBe('2026-01-31')
    expect(dates[1]).toBe('2026-02-28')
  })

  it('MONTHLY honours skipDates', () => {
    const dates = computeScheduleDates('2026-04-28', 2, 3, ['2026-05-26'], {
      frequency: 'MONTHLY',
    })
    expect(dates).toEqual(['2026-04-28', '2026-06-23', '2026-07-28'])
  })
})

describe('DAYS_OF_WEEK constant', () => {
  it('exports a 7-element label array', () => {
    expect(DAYS_OF_WEEK).toHaveLength(7)
    expect(DAYS_OF_WEEK[0]).toBe('Sun')
    expect(DAYS_OF_WEEK[6]).toBe('Sat')
  })
})
