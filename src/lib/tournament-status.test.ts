import { describe, it, expect } from 'vitest'
import { computeExpectedStatus } from './tournament-status'

describe('computeExpectedStatus', () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  it('returns null when status is COMPLETED (never reverses)', () => {
    expect(computeExpectedStatus('COMPLETED', [{ date: yesterday }])).toBeNull()
  })

  it('returns null when no rounds have dates and no tournament dates', () => {
    expect(computeExpectedStatus('REGISTRATION', [{ date: null }])).toBeNull()
  })

  it('returns null when no rounds exist and no tournament dates', () => {
    expect(computeExpectedStatus('REGISTRATION', [])).toBeNull()
  })

  it('advances REGISTRATION → ACTIVE when first round date is today', () => {
    expect(computeExpectedStatus('REGISTRATION', [{ date: today }])).toBe('ACTIVE')
  })

  it('advances REGISTRATION → ACTIVE when first round date is in the past', () => {
    expect(computeExpectedStatus('REGISTRATION', [{ date: yesterday }])).toBe('ACTIVE')
  })

  it('stays in REGISTRATION when first round is tomorrow', () => {
    expect(computeExpectedStatus('REGISTRATION', [{ date: tomorrow }])).toBeNull()
  })

  it('advances ACTIVE → COMPLETED_PENDING when day after last round', () => {
    expect(computeExpectedStatus('ACTIVE', [{ date: twoDaysAgo }])).toBe('COMPLETED_PENDING')
  })

  it('stays ACTIVE when last round is today', () => {
    expect(computeExpectedStatus('ACTIVE', [{ date: today }])).toBeNull()
  })

  it('handles multiple rounds - uses earliest for ACTIVE trigger', () => {
    expect(
      computeExpectedStatus('REGISTRATION', [
        { date: tomorrow },
        { date: today },
      ]),
    ).toBe('ACTIVE')
  })

  it('handles multiple rounds - uses latest for COMPLETED trigger', () => {
    expect(
      computeExpectedStatus('ACTIVE', [
        { date: twoDaysAgo },
        { date: yesterday },
      ]),
    ).toBe('COMPLETED_PENDING')
  })

  // ─── Tournament date fallback (open tournaments with no round dates) ───

  it('uses tournament startDate when rounds have no dates', () => {
    expect(
      computeExpectedStatus('REGISTRATION', [{ date: null }], today, tomorrow),
    ).toBe('ACTIVE')
  })

  it('uses tournament endDate for COMPLETED when rounds have no dates', () => {
    expect(
      computeExpectedStatus('ACTIVE', [{ date: null }], twoDaysAgo, twoDaysAgo),
    ).toBe('COMPLETED_PENDING')
  })

  it('stays ACTIVE when tournament endDate is today (day after not reached)', () => {
    expect(
      computeExpectedStatus('ACTIVE', [{ date: null }], yesterday, today),
    ).toBeNull()
  })

  it('stays REGISTRATION when tournament startDate is tomorrow', () => {
    expect(
      computeExpectedStatus('REGISTRATION', [{ date: null }], tomorrow, null),
    ).toBeNull()
  })
})
