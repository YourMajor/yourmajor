import { describe, it, expect } from 'vitest'
import { computeExpectedStatus } from '@/lib/tournament-status'

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(12, 0, 0, 0)
  return d
}

const today = daysFromNow(0)
const yesterday = daysFromNow(-1)
const twoDaysAgo = daysFromNow(-2)
const tomorrow = daysFromNow(1)
const nextWeek = daysFromNow(7)

// ─── computeExpectedStatus ──────────────────────────────────────────────────

describe('computeExpectedStatus', () => {
  describe('COMPLETED status (no change allowed)', () => {
    it('always returns null for COMPLETED tournament', () => {
      expect(computeExpectedStatus('COMPLETED', [{ date: yesterday }])).toBeNull()
      expect(computeExpectedStatus('COMPLETED', [])).toBeNull()
    })
  })

  describe('REGISTRATION → ACTIVE', () => {
    it('returns ACTIVE when round date is today', () => {
      expect(computeExpectedStatus('REGISTRATION', [{ date: today }])).toBe('ACTIVE')
    })

    it('returns ACTIVE when round date is in the past', () => {
      expect(computeExpectedStatus('REGISTRATION', [{ date: yesterday }])).toBe('ACTIVE')
    })

    it('returns null when round date is in the future', () => {
      expect(computeExpectedStatus('REGISTRATION', [{ date: tomorrow }])).toBeNull()
    })

    it('uses earliest round date when multiple rounds exist', () => {
      // First round is tomorrow, second is next week → no advance
      expect(computeExpectedStatus('REGISTRATION', [
        { date: tomorrow },
        { date: nextWeek },
      ])).toBeNull()

      // First round is yesterday, second is tomorrow → advance (first round started)
      expect(computeExpectedStatus('REGISTRATION', [
        { date: yesterday },
        { date: tomorrow },
      ])).toBe('ACTIVE')
    })
  })

  describe('ACTIVE → COMPLETED_PENDING', () => {
    it('returns COMPLETED_PENDING day after last round', () => {
      // Last round was yesterday → day after last round is today
      expect(computeExpectedStatus('ACTIVE', [{ date: twoDaysAgo }])).toBe('COMPLETED_PENDING')
    })

    it('returns null while last round is today', () => {
      // Last round is today → day after is tomorrow → not yet
      expect(computeExpectedStatus('ACTIVE', [{ date: today }])).toBeNull()
    })

    it('returns null while last round is in the future', () => {
      expect(computeExpectedStatus('ACTIVE', [{ date: tomorrow }])).toBeNull()
    })

    it('uses latest round date for completion check', () => {
      // Two rounds: yesterday and next week
      expect(computeExpectedStatus('ACTIVE', [
        { date: yesterday },
        { date: nextWeek },
      ])).toBeNull() // last round hasn't happened yet
    })
  })

  describe('fallback to tournament dates when no round dates', () => {
    it('returns ACTIVE when tournamentStartDate is today or past', () => {
      expect(computeExpectedStatus('REGISTRATION', [{ date: null }], today)).toBe('ACTIVE')
      expect(computeExpectedStatus('REGISTRATION', [{ date: null }], yesterday)).toBe('ACTIVE')
    })

    it('returns null when tournamentStartDate is in the future', () => {
      expect(computeExpectedStatus('REGISTRATION', [{ date: null }], tomorrow)).toBeNull()
    })

    it('returns COMPLETED_PENDING day after tournament end date', () => {
      expect(computeExpectedStatus('ACTIVE', [{ date: null }], null, twoDaysAgo)).toBe('COMPLETED_PENDING')
    })

    it('returns null when tournament end date is today', () => {
      expect(computeExpectedStatus('ACTIVE', [{ date: null }], null, today)).toBeNull()
    })

    it('returns null with no dates at all', () => {
      expect(computeExpectedStatus('REGISTRATION', [])).toBeNull()
      expect(computeExpectedStatus('REGISTRATION', [], null, null)).toBeNull()
    })
  })

  describe('rounds with mixed null dates', () => {
    it('ignores rounds with null dates', () => {
      // One null date, one real date in past
      expect(computeExpectedStatus('REGISTRATION', [
        { date: null },
        { date: yesterday },
      ])).toBe('ACTIVE')
    })

    it('falls back to tournament dates when all round dates are null', () => {
      expect(computeExpectedStatus('REGISTRATION', [
        { date: null },
        { date: null },
      ], yesterday)).toBe('ACTIVE')
    })
  })
})
