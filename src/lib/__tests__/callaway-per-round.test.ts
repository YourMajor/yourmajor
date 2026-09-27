import { describe, it, expect } from 'vitest'
import {
  callawayDeduction,
  callawayDeductionByRound,
  currentFieldRound,
  thruForRow,
} from '@/lib/scoring-utils'

// 18 holes of par 4; `strokes` lets a test make a few holes blow up.
function round(roundNumber: number, base: number, blowups: Record<number, number> = {}, holes = 18) {
  return Array.from({ length: holes }, (_, i) => ({
    holeNumber: i + 1,
    par: 4,
    strokes: blowups[i + 1] ?? base,
    roundNumber,
  }))
}

describe('callawayDeductionByRound', () => {
  const holes = new Map([[1, 18], [2, 18]])

  it('deducts each finished round on its own gross, not the combined gross', () => {
    const r1 = round(1, 5, { 3: 9 }) // gross 94
    const r2 = round(2, 5, { 7: 8 }) // gross 93
    const { total, byRound } = callawayDeductionByRound([...r1, ...r2], holes)

    expect(byRound[1]).toBe(callawayDeduction(94, r1))
    expect(byRound[2]).toBe(callawayDeduction(93, r2))
    expect(total).toBe(byRound[1] + byRound[2])
    // The old behaviour ran the table on 187 across both rounds.
    expect(total).not.toBe(callawayDeduction(187, [...r1, ...r2]))
  })

  it('counts an unfinished round at gross until it is done', () => {
    const r1 = round(1, 5, { 3: 9 })
    const r2 = round(2, 6).slice(0, 12) // mid-round
    const { byRound } = callawayDeductionByRound([...r1, ...r2], holes)

    expect(byRound[1]).toBeGreaterThan(0)
    expect(byRound[2]).toBe(0)
  })

  it('respects a 9-hole round', () => {
    const nine = round(1, 9, {}, 9) // gross 81 over 9
    const { byRound } = callawayDeductionByRound(nine, new Map([[1, 9]]))
    expect(byRound[1]).toBe(callawayDeduction(81, nine))
  })
})

describe('thruForRow', () => {
  const holesIn = (counts: Record<number, number>) =>
    Object.entries(counts).flatMap(([rn, n]) => Array.from({ length: n }, () => ({ roundNumber: Number(rn), strokes: 4 })))

  it('shows holes in the current round, 1–18, not 19–36', () => {
    const row = { holesPlayed: 25, holes: holesIn({ 1: 18, 2: 7 }) }
    expect(thruForRow(row, 2, 18, 2)).toBe(7)
  })

  it('shows F when the current round is finished', () => {
    const row = { holesPlayed: 36, holes: holesIn({ 1: 18, 2: 18 }) }
    expect(thruForRow(row, 2, 18, 2)).toBe('F')
  })

  it('shows nothing for a player who has not started the current round', () => {
    const row = { holesPlayed: 18, holes: holesIn({ 1: 18 }) }
    expect(thruForRow(row, 2, 18, 2)).toBeNull()
  })

  it('keeps single-round behaviour', () => {
    expect(thruForRow({ holesPlayed: 9, holes: holesIn({ 1: 9 }) }, 1, 18, 1)).toBe(9)
    expect(thruForRow({ holesPlayed: 18 }, null, 18, 1)).toBe('F')
  })

  it('finds the field round from the latest scored round', () => {
    expect(currentFieldRound([{ holes: holesIn({ 1: 18 }) }, { holes: holesIn({ 1: 18, 2: 3 }) }])).toBe(2)
    expect(currentFieldRound([{ holes: [] }])).toBeNull()
  })
})
