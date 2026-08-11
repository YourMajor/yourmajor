import { describe, it, expect } from 'vitest'
import {
  computeRoundStats,
  peerBaseline,
  statFindings,
  topFinding,
  type HoleStatRow,
} from '@/lib/round-stats'

/**
 * An 18-hole card built so every metric has a hand-checkable answer.
 *
 * 18 holes: 4 par-3, 10 par-4, 4 par-5.
 * GIR recorded on all 18: 8 hit, 10 missed.
 * Of the 10 missed greens, 3 are scored par or better  → scrambling 3/10 = 30%.
 * Putts recorded on all 18. On the 8 greens hit: 2,2,1,2,2,3,2,2 = 16 → 2.00/GIR.
 * Three-putts across the card: holes 6 and 13         → 2 per 18.
 * Double or worse: holes 9 (+2), 14 (+3), 18 (+2)      → 3 per 18.
 * Strokes beyond bogey on those: 1 + 2 + 1             → 4.
 * Birdies on greens hit: hole 3                        → 1/8 = 12.5%.
 * Fairways recorded on the 14 par-4/5s: 7 hit          → 50%.
 */
const card: HoleStatRow[] = [
  { par: 4, strokes: 5, gir: false, putts: 2, fairwayHit: true },   // 1  bogey, missed green, no scramble
  { par: 4, strokes: 4, gir: true,  putts: 2, fairwayHit: true },   // 2  par
  { par: 5, strokes: 4, gir: true,  putts: 1, fairwayHit: true },   // 3  BIRDIE from GIR
  { par: 3, strokes: 3, gir: true,  putts: 2 },                     // 4  par
  { par: 4, strokes: 4, gir: false, putts: 1, fairwayHit: false },  // 5  par, SCRAMBLE
  { par: 4, strokes: 5, gir: false, putts: 3, fairwayHit: false },  // 6  bogey, THREE-PUTT
  { par: 3, strokes: 4, gir: false, putts: 2 },                     // 7  bogey
  { par: 5, strokes: 5, gir: true,  putts: 2, fairwayHit: true },   // 8  par
  { par: 4, strokes: 6, gir: false, putts: 2, fairwayHit: false },  // 9  DOUBLE (+2)
  { par: 4, strokes: 4, gir: true,  putts: 2, fairwayHit: true },   // 10 par
  { par: 3, strokes: 3, gir: false, putts: 1 },                     // 11 par, SCRAMBLE
  { par: 4, strokes: 5, gir: false, putts: 2, fairwayHit: false },  // 12 bogey
  { par: 4, strokes: 5, gir: true,  putts: 3, fairwayHit: true },   // 13 bogey, THREE-PUTT
  { par: 5, strokes: 8, gir: false, putts: 2, fairwayHit: false },  // 14 TRIPLE (+3)
  { par: 4, strokes: 4, gir: false, putts: 1, fairwayHit: false },  // 15 par, SCRAMBLE
  { par: 3, strokes: 3, gir: true,  putts: 2 },                     // 16 par
  { par: 4, strokes: 4, gir: true,  putts: 2, fairwayHit: true },   // 17 par
  { par: 5, strokes: 7, gir: false, putts: 2, fairwayHit: false },  // 18 DOUBLE (+2)
]

describe('computeRoundStats', () => {
  const s = computeRoundStats(card)

  it('counts holes and total vs par', () => {
    expect(s.holes).toBe(18)
    // +1+0-1+0+0+1+1+0+2+0+0+1+1+3+0+0+0+2 = 11
    expect(s.vsPar).toBe(11)
  })

  it('counts score types', () => {
    expect(s.counts).toEqual({ eagle: 0, birdie: 1, par: 9, bogey: 5, double: 3 })
  })

  it('computes scrambling from missed greens only', () => {
    expect(s.scrambling).not.toBeNull()
    expect(s.scrambling!.sample).toBe(10)
    expect(s.scrambling!.value).toBeCloseTo(0.3, 5)
  })

  it('computes putts per GIR from greens hit only', () => {
    expect(s.puttsPerGir!.sample).toBe(8)
    expect(s.puttsPerGir!.value).toBeCloseTo(2.0, 5)
  })

  it('does not let missed greens flatter the putting number', () => {
    // Putts per hole across all 18 is 1.89 — better-looking than putts per GIR,
    // purely because missing a green means fewer putts. This is the bias the
    // metric exists to remove.
    const puttsPerHole = card.reduce((t, r) => t + (r.putts ?? 0), 0) / 18
    expect(puttsPerHole).toBeLessThan(s.puttsPerGir!.value)
  })

  it('counts three-putts and scales them to 18 holes', () => {
    expect(s.threePutts!.value).toBe(2)
    expect(s.threePutts!.per18).toBeCloseTo(2, 5)
  })

  it('counts blow-up holes and the strokes they cost beyond bogey', () => {
    expect(s.doublePlus!.value).toBe(3)
    expect(s.doublePlus!.per18).toBeCloseTo(3, 5)
    expect(s.strokesLostToDamage).toBe(4)
  })

  it('computes birdie conversion off greens hit', () => {
    expect(s.birdieConversion!.value).toBeCloseTo(1 / 8, 5)
  })

  it('counts fairways on par 4s and 5s only', () => {
    expect(s.fairways!.sample).toBe(14)
    expect(s.fairways!.value).toBeCloseTo(0.5, 5)
  })

  it('averages by par type', () => {
    // par 3s: 0, +1, 0, 0 = +1 over 4
    expect(s.parType.par3!.value).toBeCloseTo(0.25, 5)
    // par 5s: -1, 0, +3, +2 = +4 over 4
    expect(s.parType.par5!.value).toBeCloseTo(1.0, 5)
  })

  it('scales rates to 18 holes on a nine-hole card', () => {
    const nine = computeRoundStats(card.slice(0, 9))
    expect(nine.holes).toBe(9)
    // One three-putt in nine holes is two per round.
    expect(nine.threePutts!.per18).toBeCloseTo(2, 5)
  })
})

describe('minimum samples', () => {
  it('returns null rather than a verdict off too few holes', () => {
    // Three holes, one missed green: not enough for any rate.
    const thin: HoleStatRow[] = [
      { par: 4, strokes: 5, gir: false, putts: 2, fairwayHit: false },
      { par: 4, strokes: 4, gir: true, putts: 2, fairwayHit: true },
      { par: 3, strokes: 3, gir: true, putts: 2 },
    ]
    const s = computeRoundStats(thin)
    expect(s.scrambling).toBeNull()
    expect(s.puttsPerGir).toBeNull()
    expect(s.threePutts).toBeNull()
    expect(s.doublePlus).toBeNull()
    expect(s.fairways).toBeNull()
    expect(statFindings(s, 15)).toEqual([])
  })

  it('emits nothing when the stats were never recorded', () => {
    const strokesOnly: HoleStatRow[] = card.map((r) => ({ par: r.par, strokes: r.strokes }))
    const s = computeRoundStats(strokesOnly)
    expect(s.scrambling).toBeNull()
    expect(s.puttsPerGir).toBeNull()
    // Double-plus needs only strokes and par, so it still reports.
    expect(s.doublePlus!.value).toBe(3)
  })
})

describe('peerBaseline', () => {
  it('returns the anchor values at an anchor handicap', () => {
    expect(peerBaseline(15).scrambling).toBeCloseTo(0.22, 5)
    expect(peerBaseline(10).puttsPerGir).toBeCloseTo(2.0, 5)
  })

  it('interpolates between anchors', () => {
    // Halfway between hcp 10 (0.28) and hcp 15 (0.22).
    expect(peerBaseline(12.5).scrambling).toBeCloseTo(0.25, 5)
    expect(peerBaseline(12.5).threePuttsPer18).toBeCloseTo(3.1, 5)
  })

  it('clamps below and above the anchor range', () => {
    expect(peerBaseline(-4).scrambling).toBeCloseTo(0.6, 5)
    expect(peerBaseline(40).doublePlusPer18).toBeCloseTo(6.5, 5)
  })

  it('falls back to a mid handicap when given a non-finite value', () => {
    expect(peerBaseline(NaN).scrambling).toBeCloseTo(0.22, 5)
  })
})

describe('statFindings', () => {
  const findings = statFindings(computeRoundStats(card), 15)

  it('ranks findings by impact, most costly first', () => {
    const impacts = findings.map((f) => f.impact)
    expect(impacts).toEqual([...impacts].sort((a, b) => a - b))
    expect(topFinding(findings)!.impact).toBeCloseTo(Math.min(...impacts), 5)
  })

  it('reports no weakness when the card beats the peer everywhere', () => {
    // This card is genuinely good against a 15-handicap: 30% scrambling, two
    // three-putts, 2.00 putts per green. Manufacturing a weakness would be the
    // bug — the section is meant to be honest, not to always find fault.
    expect(findings.every((f) => f.kind === 'strength')).toBe(true)
  })

  it('surfaces a weakness, ranked first, on a card that earns one', () => {
    // Same shape, but every missed green is dropped and the greens are
    // three-putted: scrambling 0%, three-putts everywhere.
    const poor: HoleStatRow[] = card.map((r) =>
      r.gir === false
        ? { ...r, strokes: r.par + 2, putts: 3 }
        : { ...r, strokes: r.par + 1, putts: 3 }
    )
    const bad = statFindings(computeRoundStats(poor), 15)
    const top = topFinding(bad)!
    expect(top.kind).toBe('weakness')
    expect(top.impact).toBeLessThan(0)
    expect(top.impact).toBeCloseTo(Math.min(...bad.map((f) => f.impact)), 5)
  })

  it('reads scrambling above the peer rate as a strength', () => {
    // 30% scrambling beats the 22% a 15-handicap averages.
    const shortGame = findings.find((f) => f.area === 'Short game')
    expect(shortGame?.kind).toBe('strength')
  })

  it('attributes the baseline to a handicap in the copy', () => {
    for (const f of findings.filter((x) => x.impact !== 0)) {
      expect(f.message).toMatch(/\d+-handicap/)
    }
  })

  it('suppresses findings worth less than half a stroke a round', () => {
    for (const f of findings) {
      expect(Math.abs(f.impact) === 0 || Math.abs(f.impact) >= 0.5).toBe(true)
    }
  })

  it('moves the verdict when the peer baseline moves', () => {
    // The same card judged against a scratch baseline should look worse.
    const vsScratch = statFindings(computeRoundStats(card), 0)
    const vsBogey = statFindings(computeRoundStats(card), 25)
    const worst = (fs: typeof vsScratch) => Math.min(...fs.map((f) => f.impact))
    expect(worst(vsScratch)).toBeLessThan(worst(vsBogey))
  })
})
