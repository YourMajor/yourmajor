import { describe, it, expect } from 'vitest'
import { pickDefaultRound } from '@/lib/play-round'

const r1 = { id: 'r1', roundNumber: 1, holeCount: 18 }
const r2 = { id: 'r2', roundNumber: 2, holeCount: 18 }

describe('pickDefaultRound', () => {
  it('opens round 1 before anything is scored', () => {
    expect(pickDefaultRound([r1, r2], new Map())?.id).toBe('r1')
  })

  it('stays on round 1 while it is unfinished', () => {
    expect(pickDefaultRound([r1, r2], new Map([['r1', 12]]))?.id).toBe('r1')
  })

  it('moves to round 2 once round 1 is fully scored', () => {
    expect(pickDefaultRound([r1, r2], new Map([['r1', 18]]))?.id).toBe('r2')
  })

  it('shows the last round when every round is done', () => {
    expect(pickDefaultRound([r2, r1], new Map([['r1', 18], ['r2', 18]]))?.id).toBe('r2')
  })

  it('respects a 9-hole course', () => {
    const nine = { id: 'n', roundNumber: 1, holeCount: 9 }
    expect(pickDefaultRound([nine, r2], new Map([['n', 9]]))?.id).toBe('r2')
  })

  it('returns undefined with no rounds', () => {
    expect(pickDefaultRound([], new Map())).toBeUndefined()
  })
})
