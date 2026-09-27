import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { firstTeeInstant, roundOpenState, zonedWallClockToUtc } from '@/lib/round-open'

// Tee times are stored as wall-clock hours in the UTC fields.
const tee = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 26, h, m))
const day = (y: number, mo: number, d: number) => new Date(Date.UTC(y, mo, d))

describe('zonedWallClockToUtc', () => {
  it('converts Toronto summer time (UTC-4)', () => {
    expect(zonedWallClockToUtc(2026, 8, 27, 9, 30, 'America/Toronto').toISOString()).toBe('2026-09-27T13:30:00.000Z')
  })
  it('converts Toronto winter time (UTC-5)', () => {
    expect(zonedWallClockToUtc(2026, 11, 1, 9, 0, 'America/Toronto').toISOString()).toBe('2026-12-01T14:00:00.000Z')
  })
  it('converts Vancouver', () => {
    expect(zonedWallClockToUtc(2026, 8, 27, 8, 0, 'America/Vancouver').toISOString()).toBe('2026-09-27T15:00:00.000Z')
  })
})

describe('firstTeeInstant', () => {
  it('uses the round date at the earliest group tee time', () => {
    const t = firstTeeInstant(day(2026, 8, 27), [tee(10, 10), tee(9, 30), null], 'America/Toronto')
    expect(t?.toISOString()).toBe('2026-09-27T13:30:00.000Z')
  })
  it('falls back to Toronto when no time zone is recorded', () => {
    const t = firstTeeInstant(day(2026, 8, 27), [tee(9, 30)], null)
    expect(t?.toISOString()).toBe('2026-09-27T13:30:00.000Z')
  })
  it('is null without a round date or any tee time', () => {
    expect(firstTeeInstant(null, [tee(9)], 'America/Toronto')).toBeNull()
    expect(firstTeeInstant(day(2026, 8, 27), [null], 'America/Toronto')).toBeNull()
  })
})

describe('roundOpenState', () => {
  const firstTee = new Date('2026-09-27T13:30:00Z') // 9:30 AM Toronto
  const base = { roundNumber: 2, openedAt: null, hasScores: false }

  it('always opens round 1', () => {
    expect(roundOpenState({ ...base, roundNumber: 1 }, null).open).toBe(true)
  })

  it('stays closed until 3 hours before the first tee', () => {
    const s = roundOpenState(base, firstTee, new Date('2026-09-27T10:29:00Z'))
    expect(s).toMatchObject({ open: false, reason: 'scheduled' })
    expect(s.opensAt?.toISOString()).toBe('2026-09-27T10:30:00.000Z')
  })

  it('opens automatically at tee time minus 3 hours', () => {
    expect(roundOpenState(base, firstTee, new Date('2026-09-27T10:30:00Z'))).toMatchObject({ open: true, reason: 'auto' })
  })

  it('opens early when an admin launches it', () => {
    const s = roundOpenState({ ...base, openedAt: new Date('2026-09-26T20:00:00Z') }, firstTee, new Date('2026-09-26T21:00:00Z'))
    expect(s).toMatchObject({ open: true, reason: 'launched' })
  })

  it('never closes a round that already has scores', () => {
    expect(roundOpenState({ ...base, hasScores: true }, firstTee, new Date('2026-09-26T00:00:00Z'))).toMatchObject({ open: true, reason: 'started' })
  })

  it('needs a launch when there is no tee time to go on', () => {
    expect(roundOpenState(base, null)).toMatchObject({ open: false, reason: 'needs-launch', opensAt: null })
  })
})
