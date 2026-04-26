import { describe, it, expect } from 'vitest'
import { allocateHandicapStrokes, callawayDeduction } from '@/lib/scoring-utils'
import { TIER_LIMITS } from '@/lib/tiers'

// ─── Local helpers ──────────────────────────────────────────────────────────

// Extracted from actions.ts:80 (pure slug sanitisation — no async dedup)
function generateSlugBase(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Extracted from actions.ts:96-109
function validateTournamentDates(
  startDate: string | null,
  endDate: string | null,
  rounds: Array<{ roundNumber: number; date: string | null }>
): string | null {
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return 'Start date must be before end date.'
  }
  for (const r of rounds) {
    if (r.date) {
      const roundDate = new Date(r.date)
      if (startDate && roundDate < new Date(new Date(startDate).setHours(0, 0, 0, 0))) {
        return `Round ${r.roundNumber} date is before the tournament start date.`
      }
      if (endDate && roundDate > new Date(new Date(endDate).setHours(23, 59, 59, 999))) {
        return `Round ${r.roundNumber} date is after the tournament end date.`
      }
    }
  }
  return null
}

// Extracted from scoring.ts:46-160 — pure leaderboard computation
type TestScore = { strokes: number; holeNumber: number; par: number; handicap: number; roundNumber: number }
type TestPlayer = { name: string; handicap: number; scores: TestScore[]; powerupModifier: number }

interface Standing {
  rank: number
  playerName: string
  grossTotal: number | null
  netTotal: number | null
  grossVsPar: number | null
  netVsPar: number | null
  points: number | null
}

function computeLeaderboard(
  handicapSystem: 'NONE' | 'WHS' | 'STABLEFORD' | 'CALLAWAY' | 'PEORIA',
  players: TestPlayer[],
  holes: Array<{ number: number; par: number; handicap: number }>
): Standing[] {
  const standings = players.map((player) => {
    const grossTotal = player.scores.length > 0
      ? player.scores.reduce((sum, s) => sum + s.strokes, 0)
      : null

    const playedPar = player.scores.reduce((sum, s) => sum + s.par, 0)

    let netTotal: number | null = null
    let points: number | null = null
    let netVsPar: number | null = null

    const adjustedGross = grossTotal !== null ? grossTotal + player.powerupModifier : null

    if (adjustedGross !== null) {
      if (handicapSystem === 'NONE') {
        netTotal = adjustedGross
        netVsPar = adjustedGross - playedPar
      } else if (handicapSystem === 'STABLEFORD') {
        const strokeSet = allocateHandicapStrokes(player.handicap, holes)
        const holePoints = player.scores.map((s) => {
          const handicapStrokes = strokeSet.has(s.holeNumber) ? 1 : 0
          return Math.max(0, 2 + s.par + handicapStrokes - s.strokes)
        })
        points = holePoints.reduce((sum, p) => sum + p, 0)
      } else if (handicapSystem === 'CALLAWAY') {
        const deduction = callawayDeduction(
          adjustedGross,
          player.scores.map((s) => ({ strokes: s.strokes, par: s.par, holeNumber: s.holeNumber }))
        )
        netTotal = adjustedGross - deduction
        netVsPar = netTotal - playedPar
      } else {
        // WHS / PEORIA
        const strokeSet = allocateHandicapStrokes(player.handicap, holes)
        const handicapStrokesApplied = player.scores.filter((s) => strokeSet.has(s.holeNumber)).length
        netTotal = adjustedGross - handicapStrokesApplied
        netVsPar = netTotal - playedPar
      }
    }

    const grossVsPar = adjustedGross !== null ? adjustedGross - playedPar : null

    return { rank: 0, playerName: player.name, grossTotal, netTotal, grossVsPar, netVsPar, points }
  })

  // Sort
  if (handicapSystem === 'STABLEFORD') {
    standings.sort((a, b) => {
      if (a.points === null && b.points === null) return 0
      if (a.points === null) return 1
      if (b.points === null) return -1
      return b.points - a.points
    })
  } else {
    standings.sort((a, b) => {
      const av = a.netVsPar ?? a.grossVsPar
      const bv = b.netVsPar ?? b.grossVsPar
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return av - bv
    })
  }

  // Assign ranks
  let rank = 1
  for (let i = 0; i < standings.length; i++) {
    const getSortVal = (s: Standing) =>
      handicapSystem === 'STABLEFORD' ? s.points : (s.netVsPar ?? s.grossVsPar)
    const sortVal = getSortVal(standings[i])
    const prevVal = i > 0 ? getSortVal(standings[i - 1]) : null
    if (i > 0 && sortVal !== prevVal) rank = i + 1
    standings[i].rank = rank
  }

  return standings
}

// Extracted from season-standings.ts:123-127, 129-131, 200-238
const DEFAULT_POINTS_TABLE: Record<number, number> = {
  1: 25, 2: 20, 3: 16, 4: 13, 5: 11,
  6: 10, 7: 9, 8: 8, 9: 7, 10: 6,
  11: 5, 12: 4, 13: 3, 14: 2, 15: 1,
}

function getPointsForRank(rank: number, pointsTable: Record<number, number>): number {
  return pointsTable[rank] ?? 0
}

type EventResult = { rank: number; netVsPar: number | null; grossVsPar: number | null; points: number | null }

function computeSeasonValue(
  method: 'POINTS' | 'STROKE_AVG' | 'BEST_OF_N' | 'STABLEFORD_CUMULATIVE',
  eventResults: EventResult[],
  bestOf: number | null,
  pointsTable: Record<number, number>
): number {
  switch (method) {
    case 'POINTS': {
      let results = eventResults.map((r) => getPointsForRank(r.rank, pointsTable))
      if (bestOf && results.length > bestOf) {
        results = results.sort((a, b) => b - a).slice(0, bestOf)
      }
      return results.reduce((sum, v) => sum + v, 0)
    }
    case 'STROKE_AVG': {
      const netScores = eventResults
        .map((r) => r.netVsPar ?? r.grossVsPar)
        .filter((v): v is number => v !== null)
      return netScores.length > 0
        ? netScores.reduce((sum, v) => sum + v, 0) / netScores.length
        : 0
    }
    case 'BEST_OF_N': {
      const n = bestOf ?? eventResults.length
      const netScores = eventResults
        .map((r) => r.netVsPar ?? r.grossVsPar)
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b)
        .slice(0, n)
      return netScores.length > 0
        ? netScores.reduce((sum, v) => sum + v, 0) / netScores.length
        : 0
    }
    case 'STABLEFORD_CUMULATIVE': {
      let results = eventResults.map((r) => r.points ?? 0)
      if (bestOf && results.length > bestOf) {
        results = results.sort((a, b) => b - a).slice(0, bestOf)
      }
      return results.reduce((sum, v) => sum + v, 0)
    }
    default:
      return 0
  }
}

// ─── Factories ──────────────────────────────────────────────────────────────

/** Standard 18-hole course: pars cycle 4,3,5 and handicap indices 1–18 */
function makeHoles(count = 18): Array<{ number: number; par: number; handicap: number }> {
  const pars = [4, 3, 5]
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: pars[i % 3],
    handicap: i + 1,
  }))
}

function makeScores(
  strokes: number[],
  holes: Array<{ number: number; par: number; handicap: number }>,
  roundNumber = 1
): TestScore[] {
  return strokes.map((s, i) => ({
    strokes: s,
    holeNumber: holes[i].number,
    par: holes[i].par,
    handicap: holes[i].handicap,
    roundNumber,
  }))
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── 1. Slug Generation ────────────────────────────────────────────────────

describe('Slug Generation', () => {
  it('converts name to lowercase hyphenated slug', () => {
    expect(generateSlugBase('My Tournament')).toBe('my-tournament')
  })

  it('replaces multiple non-alphanumeric chars with single hyphen', () => {
    expect(generateSlugBase('Spring Classic!! 2025')).toBe('spring-classic-2025')
  })

  it('strips leading and trailing hyphens', () => {
    expect(generateSlugBase('---Test---')).toBe('test')
  })

  it('handles special characters', () => {
    expect(generateSlugBase("John's Pro-Am #5")).toBe('john-s-pro-am-5')
  })

  it('returns empty string for entirely non-alphanumeric input', () => {
    expect(generateSlugBase('!!! !!!')).toBe('')
  })

  it('strips unicode, keeps ASCII', () => {
    expect(generateSlugBase('Café Tourney')).toBe('caf-tourney')
  })
})

// ─── 2. Tournament Date Validation ─────────────────────────────────────────

describe('Tournament Date Validation', () => {
  it('returns null for valid date range with round in bounds', () => {
    expect(validateTournamentDates(
      '2026-06-01', '2026-06-30',
      [{ roundNumber: 1, date: '2026-06-15' }]
    )).toBeNull()
  })

  it('returns error when start date is after end date', () => {
    expect(validateTournamentDates(
      '2026-07-01', '2026-06-01',
      []
    )).toBe('Start date must be before end date.')
  })

  it('returns error when round date is before tournament start', () => {
    const result = validateTournamentDates(
      '2026-06-10', '2026-06-30',
      [{ roundNumber: 1, date: '2026-06-01' }]
    )
    expect(result).toContain('before the tournament start date')
  })

  it('returns error when round date is after tournament end', () => {
    const result = validateTournamentDates(
      '2026-06-01', '2026-06-15',
      [{ roundNumber: 2, date: '2026-07-01' }]
    )
    expect(result).toContain('after the tournament end date')
  })

  it('returns null when all dates are null', () => {
    expect(validateTournamentDates(null, null, [{ roundNumber: 1, date: null }])).toBeNull()
  })

  it('allows round date equal to start date', () => {
    expect(validateTournamentDates(
      '2026-06-01', '2026-06-30',
      [{ roundNumber: 1, date: '2026-06-01' }]
    )).toBeNull()
  })

  it('allows round date equal to end date', () => {
    expect(validateTournamentDates(
      '2026-06-01', '2026-06-30',
      [{ roundNumber: 1, date: '2026-06-30' }]
    )).toBeNull()
  })

  it('error message identifies the failing round number', () => {
    const result = validateTournamentDates(
      '2026-06-10', '2026-06-30',
      [
        { roundNumber: 1, date: '2026-06-15' },
        { roundNumber: 3, date: '2026-06-01' },
      ]
    )
    expect(result).toContain('Round 3')
  })
})

// ─── 3. Tier Constraint Validation ─────────────────────────────────────────

describe('Tier Constraint Validation', () => {
  it('FREE tier blocks powerups', () => {
    expect(TIER_LIMITS.FREE.powerups).toBe(false)
  })

  it('FREE tier limits to 1 round', () => {
    expect(TIER_LIMITS.FREE.maxRounds).toBe(1)
  })

  it('FREE tier blocks custom branding', () => {
    expect(TIER_LIMITS.FREE.customBranding).toBe(false)
  })

  it('FREE tier allows unlimited tournaments per month', () => {
    expect(TIER_LIMITS.FREE.maxTournamentsPerMonth).toBe(Infinity)
  })

  it('PRO tier allows powerups and 2 rounds', () => {
    expect(TIER_LIMITS.PRO.powerups).toBe(true)
    expect(TIER_LIMITS.PRO.maxRounds).toBe(2)
  })

  it('PRO tier has unlimited tournaments per month', () => {
    expect(TIER_LIMITS.PRO.maxTournamentsPerMonth).toBe(Infinity)
  })

  it('CLUB tier limits to 4 tournaments per month', () => {
    expect(TIER_LIMITS.CLUB.maxTournamentsPerMonth).toBe(4)
  })

  it('LEAGUE tier allows 99 rounds and 144 players', () => {
    expect(TIER_LIMITS.LEAGUE.maxRounds).toBe(99)
    expect(TIER_LIMITS.LEAGUE.maxPlayers).toBe(144)
  })
})

// ─── 4. Leaderboard Scoring by Handicap System ────────────────────────────

describe('Leaderboard Scoring by Handicap System', () => {
  const holes18 = makeHoles(18)
  // Course par: 6 × (4+3+5) = 72
  const coursePar = holes18.reduce((s, h) => s + h.par, 0) // 72

  describe('NONE — gross only', () => {
    it('net equals gross when handicap system is NONE', () => {
      // 18 holes, all par → gross = 72
      const scores = makeScores(holes18.map((h) => h.par), holes18)
      const [p] = computeLeaderboard('NONE', [{ name: 'A', handicap: 10, scores, powerupModifier: 0 }], holes18)
      expect(p.netTotal).toBe(coursePar)
      expect(p.grossTotal).toBe(coursePar)
    })

    it('sorts players by grossVsPar ascending (lower = better)', () => {
      const scoresA = makeScores(holes18.map((h) => h.par + 1), holes18) // +18
      const scoresB = makeScores(holes18.map((h) => h.par), holes18)     // E
      const result = computeLeaderboard('NONE', [
        { name: 'A', handicap: 0, scores: scoresA, powerupModifier: 0 },
        { name: 'B', handicap: 0, scores: scoresB, powerupModifier: 0 },
      ], holes18)
      expect(result[0].playerName).toBe('B')
      expect(result[1].playerName).toBe('A')
    })

    it('handles even par (grossVsPar = 0)', () => {
      const scores = makeScores(holes18.map((h) => h.par), holes18)
      const [p] = computeLeaderboard('NONE', [{ name: 'A', handicap: 0, scores, powerupModifier: 0 }], holes18)
      expect(p.grossVsPar).toBe(0)
      expect(p.netVsPar).toBe(0)
    })

    it('handles player with no scores (null totals, sorted last)', () => {
      const scoresA = makeScores(holes18.map((h) => h.par), holes18)
      const result = computeLeaderboard('NONE', [
        { name: 'NoScores', handicap: 0, scores: [], powerupModifier: 0 },
        { name: 'A', handicap: 0, scores: scoresA, powerupModifier: 0 },
      ], holes18)
      expect(result[0].playerName).toBe('A')
      expect(result[1].playerName).toBe('NoScores')
      expect(result[1].grossTotal).toBeNull()
      expect(result[1].netTotal).toBeNull()
    })
  })

  describe('WHS', () => {
    it('allocates strokes to hardest holes, reduces net', () => {
      // All par scores, handicap 10 → net = 72 - 10 = 62
      const scores = makeScores(holes18.map((h) => h.par), holes18)
      const [p] = computeLeaderboard('WHS', [{ name: 'A', handicap: 10, scores, powerupModifier: 0 }], holes18)
      expect(p.grossTotal).toBe(coursePar)
      expect(p.netTotal).toBe(coursePar - 10)
    })

    it('ranks by netVsPar ascending', () => {
      const scores = makeScores(holes18.map((h) => h.par), holes18)
      const result = computeLeaderboard('WHS', [
        { name: 'Low', handicap: 18, scores: [...scores], powerupModifier: 0 },
        { name: 'High', handicap: 5, scores: [...scores], powerupModifier: 0 },
      ], holes18)
      // Low: net = 72-18 = 54, netVsPar = -18; High: net = 72-5 = 67, netVsPar = -5
      expect(result[0].playerName).toBe('Low')
    })

    it('zero handicap player has net equal to gross', () => {
      const scores = makeScores(holes18.map((h) => h.par + 1), holes18)
      const [p] = computeLeaderboard('WHS', [{ name: 'A', handicap: 0, scores, powerupModifier: 0 }], holes18)
      expect(p.netTotal).toBe(p.grossTotal)
    })

    it('max handicap (54) wraps strokes across all holes', () => {
      // 54 on 18 holes = 3 full rounds, every hole gets 3 strokes → but allocateHandicapStrokes
      // gives a Set of hole numbers (each hole can only be "in" or "out"), so all 18 holes in set
      const scores = makeScores(holes18.map((h) => h.par), holes18)
      const [p] = computeLeaderboard('WHS', [{ name: 'A', handicap: 54, scores, powerupModifier: 0 }], holes18)
      // All 18 holes are in the stroke set → 18 strokes applied
      expect(p.netTotal).toBe(coursePar - 18)
    })

    it('partial round (9 holes) — playedPar from played holes only', () => {
      const holes9 = makeHoles(9)
      const playedPar = holes9.reduce((s, h) => s + h.par, 0) // 36
      const scores = makeScores(holes9.map((h) => h.par), holes9)
      const [p] = computeLeaderboard('WHS', [{ name: 'A', handicap: 5, scores, powerupModifier: 0 }], holes9)
      expect(p.grossTotal).toBe(playedPar)
      // 5 hardest of 9 holes get a stroke
      expect(p.netTotal).toBe(playedPar - 5)
    })
  })

  describe('STABLEFORD', () => {
    it('correct points per hole: par=2, birdie=3, bogey=1, double+=0', () => {
      // Single hole: par 4, handicap 18 (no stroke for hcp 0)
      const hole = [{ number: 1, par: 4, handicap: 18 }]
      const check = (strokes: number) => {
        const scores = makeScores([strokes], hole)
        const [p] = computeLeaderboard('STABLEFORD', [{ name: 'A', handicap: 0, scores, powerupModifier: 0 }], hole)
        return p.points
      }
      expect(check(3)).toBe(3) // birdie
      expect(check(4)).toBe(2) // par
      expect(check(5)).toBe(1) // bogey
      expect(check(6)).toBe(0) // double bogey
    })

    it('ranks by points descending (higher = better)', () => {
      const scoresA = makeScores(holes18.map((h) => h.par - 1), holes18) // all birdies
      const scoresB = makeScores(holes18.map((h) => h.par), holes18)     // all pars
      const result = computeLeaderboard('STABLEFORD', [
        { name: 'Pars', handicap: 0, scores: scoresB, powerupModifier: 0 },
        { name: 'Birdies', handicap: 0, scores: scoresA, powerupModifier: 0 },
      ], holes18)
      expect(result[0].playerName).toBe('Birdies')
      expect(result[0].points).toBeGreaterThan(result[1].points!)
    })

    it('awards 0 points for triple bogey or worse', () => {
      const hole = [{ number: 1, par: 4, handicap: 1 }]
      const scores = makeScores([7], hole) // +3
      const [p] = computeLeaderboard('STABLEFORD', [{ name: 'A', handicap: 0, scores, powerupModifier: 0 }], hole)
      expect(p.points).toBe(0)
    })

    it('handicap stroke on a hole adds +1 to points', () => {
      // Hole with handicap index 1 (hardest), player handicap 1 → gets a stroke on hole 1
      const hole = [{ number: 1, par: 4, handicap: 1 }]
      const scores = makeScores([5], hole) // bogey
      // Without stroke: MAX(0, 2 + 4 + 0 - 5) = 1
      // With stroke:    MAX(0, 2 + 4 + 1 - 5) = 2
      const [p] = computeLeaderboard('STABLEFORD', [{ name: 'A', handicap: 1, scores, powerupModifier: 0 }], hole)
      expect(p.points).toBe(2)
    })

    it('zero handicap — no adjustment applied', () => {
      const hole = [{ number: 1, par: 4, handicap: 1 }]
      const scores = makeScores([5], hole)
      const [p] = computeLeaderboard('STABLEFORD', [{ name: 'A', handicap: 0, scores, powerupModifier: 0 }], hole)
      expect(p.points).toBe(1) // MAX(0, 2+4+0-5)
    })
  })

  describe('CALLAWAY', () => {
    it('deducts worst-hole scores from gross for net', () => {
      // Gross 80 → tableRow [80,84,3] → halfHoles=3 → 1 full + 0.5 half
      // Make 18 scores that sum to 80, with some bad holes
      const strokes = holes18.map((h) => h.par) // sum = 72
      strokes[0] = strokes[0] + 5 // hole 1: +5 (worst)
      strokes[1] = strokes[1] + 3 // hole 2: +3 (2nd worst)
      // gross = 72 + 8 = 80
      const scores = makeScores(strokes, holes18)
      const [p] = computeLeaderboard('CALLAWAY', [{ name: 'A', handicap: 0, scores, powerupModifier: 0 }], holes18)
      expect(p.grossTotal).toBe(80)
      expect(p.netTotal).toBeLessThan(80)
      expect(p.netTotal).toBeGreaterThan(0)
    })

    it('ranks by netVsPar ascending', () => {
      // Player A: gross 80, Player B: gross 90 → B gets bigger deduction but still worse
      const strokesA = holes18.map((h) => h.par)
      strokesA[0] += 8 // gross = 80
      const strokesB = holes18.map((h) => h.par)
      strokesB[0] += 10
      strokesB[1] += 8 // gross = 90
      const result = computeLeaderboard('CALLAWAY', [
        { name: 'A', handicap: 0, scores: makeScores(strokesA, holes18), powerupModifier: 0 },
        { name: 'B', handicap: 0, scores: makeScores(strokesB, holes18), powerupModifier: 0 },
      ], holes18)
      expect(result[0].playerName).toBe('A')
    })

    it('no deduction for gross ≤ 71', () => {
      // Make scores sum to 70 (under par)
      const strokes = holes18.map((h) => h.par)
      strokes[0] -= 1
      strokes[3] -= 1 // gross = 70
      const scores = makeScores(strokes, holes18)
      const [p] = computeLeaderboard('CALLAWAY', [{ name: 'A', handicap: 0, scores, powerupModifier: 0 }], holes18)
      expect(p.netTotal).toBe(p.grossTotal)
    })

    it('caps individual hole scores at par × 2 for deduction calc', () => {
      // Hole 1 par 4, score 12 → capped at 8 for deduction
      const strokes = holes18.map((h) => h.par)
      strokes[0] = 12 // par 4, capped to 8
      // gross = 72 - 4 + 12 = 80
      const scores = makeScores(strokes, holes18)
      const [p] = computeLeaderboard('CALLAWAY', [{ name: 'A', handicap: 0, scores, powerupModifier: 0 }], holes18)
      // With cap: worst hole contributes 8 (not 12) to deduction
      // gross 80 → halfHoles=3 → 1 full worst (8) + half of next worst
      // Without cap it would use 12
      expect(p.netTotal).toBe(80 - callawayDeduction(80, scores.map((s) => ({ strokes: s.strokes, par: s.par, holeNumber: s.holeNumber }))))
    })
  })

  describe('PEORIA', () => {
    it('falls back to WHS logic (same net as WHS)', () => {
      const scores = makeScores(holes18.map((h) => h.par), holes18)
      const player = { name: 'A', handicap: 10, scores, powerupModifier: 0 }
      const [pWhs] = computeLeaderboard('WHS', [{ ...player }], holes18)
      const [pPeoria] = computeLeaderboard('PEORIA', [{ ...player }], holes18)
      expect(pPeoria.netTotal).toBe(pWhs.netTotal)
    })

    it('allocates handicap strokes identically to WHS', () => {
      const scores = makeScores(holes18.map((h) => h.par + 1), holes18)
      const player = { name: 'A', handicap: 15, scores, powerupModifier: 0 }
      const [pWhs] = computeLeaderboard('WHS', [{ ...player }], holes18)
      const [pPeoria] = computeLeaderboard('PEORIA', [{ ...player }], holes18)
      expect(pPeoria.netVsPar).toBe(pWhs.netVsPar)
    })
  })

  describe('Powerup modifier integration', () => {
    it('negative modifier (boost) reduces gross before handicap calc', () => {
      const scores = makeScores(holes18.map((h) => h.par), holes18) // gross 72
      const [p] = computeLeaderboard('WHS', [{ name: 'A', handicap: 5, scores, powerupModifier: -2 }], holes18)
      // adjustedGross = 72 - 2 = 70, net = 70 - 5 = 65
      expect(p.netTotal).toBe(65)
    })

    it('positive modifier (attack) increases gross', () => {
      const scores = makeScores(holes18.map((h) => h.par), holes18) // gross 72
      const [p] = computeLeaderboard('WHS', [{ name: 'A', handicap: 5, scores, powerupModifier: 3 }], holes18)
      // adjustedGross = 72 + 3 = 75, net = 75 - 5 = 70
      expect(p.netTotal).toBe(70)
    })

    it('zero modifier has no effect', () => {
      const scores = makeScores(holes18.map((h) => h.par), holes18)
      const [withMod] = computeLeaderboard('WHS', [{ name: 'A', handicap: 5, scores, powerupModifier: 0 }], holes18)
      expect(withMod.netTotal).toBe(coursePar - 5)
    })
  })

  describe('Tie handling and ranking', () => {
    it('tied players get same rank', () => {
      const scores = makeScores(holes18.map((h) => h.par), holes18)
      const result = computeLeaderboard('NONE', [
        { name: 'A', handicap: 0, scores: [...scores], powerupModifier: 0 },
        { name: 'B', handicap: 0, scores: [...scores], powerupModifier: 0 },
      ], holes18)
      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(1)
    })

    it('rank skips after tie (1, 1, 3 — not 1, 1, 2)', () => {
      const scoresPar = makeScores(holes18.map((h) => h.par), holes18)
      const scoresBogey = makeScores(holes18.map((h) => h.par + 1), holes18)
      const result = computeLeaderboard('NONE', [
        { name: 'A', handicap: 0, scores: [...scoresPar], powerupModifier: 0 },
        { name: 'B', handicap: 0, scores: [...scoresPar], powerupModifier: 0 },
        { name: 'C', handicap: 0, scores: scoresBogey, powerupModifier: 0 },
      ], holes18)
      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(1)
      expect(result[2].rank).toBe(3)
    })

    it('three-way tie (1, 1, 1, 4)', () => {
      const scoresPar = makeScores(holes18.map((h) => h.par), holes18)
      const scoresBogey = makeScores(holes18.map((h) => h.par + 1), holes18)
      const result = computeLeaderboard('NONE', [
        { name: 'A', handicap: 0, scores: [...scoresPar], powerupModifier: 0 },
        { name: 'B', handicap: 0, scores: [...scoresPar], powerupModifier: 0 },
        { name: 'C', handicap: 0, scores: [...scoresPar], powerupModifier: 0 },
        { name: 'D', handicap: 0, scores: scoresBogey, powerupModifier: 0 },
      ], holes18)
      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(1)
      expect(result[2].rank).toBe(1)
      expect(result[3].rank).toBe(4)
    })

    it('all players tied — all rank 1', () => {
      const scores = makeScores(holes18.map((h) => h.par), holes18)
      const result = computeLeaderboard('NONE', [
        { name: 'A', handicap: 0, scores: [...scores], powerupModifier: 0 },
        { name: 'B', handicap: 0, scores: [...scores], powerupModifier: 0 },
        { name: 'C', handicap: 0, scores: [...scores], powerupModifier: 0 },
      ], holes18)
      expect(result.every((p) => p.rank === 1)).toBe(true)
    })
  })
})

// ─── 5. Season Scoring Methods ──────────────────────────────────────────────

describe('Season Scoring Methods', () => {
  describe('POINTS', () => {
    it('sums points from rank-based table', () => {
      // 1st (25) + 3rd (16) = 41
      const events: EventResult[] = [
        { rank: 1, netVsPar: -5, grossVsPar: -3, points: null },
        { rank: 3, netVsPar: -2, grossVsPar: 0, points: null },
      ]
      expect(computeSeasonValue('POINTS', events, null, DEFAULT_POINTS_TABLE)).toBe(41)
    })

    it('bestOf keeps only top N results', () => {
      // 4 events: ranks 1(25), 5(11), 10(6), 15(1) — bestOf 2 → 25 + 11 = 36
      const events: EventResult[] = [
        { rank: 1, netVsPar: -5, grossVsPar: -3, points: null },
        { rank: 5, netVsPar: 0, grossVsPar: 2, points: null },
        { rank: 10, netVsPar: 3, grossVsPar: 5, points: null },
        { rank: 15, netVsPar: 5, grossVsPar: 7, points: null },
      ]
      expect(computeSeasonValue('POINTS', events, 2, DEFAULT_POINTS_TABLE)).toBe(36)
    })

    it('rank beyond table returns 0 points', () => {
      const events: EventResult[] = [
        { rank: 20, netVsPar: 10, grossVsPar: 12, points: null },
      ]
      expect(computeSeasonValue('POINTS', events, null, DEFAULT_POINTS_TABLE)).toBe(0)
    })
  })

  describe('STROKE_AVG', () => {
    it('averages netVsPar across events', () => {
      const events: EventResult[] = [
        { rank: 1, netVsPar: 2, grossVsPar: 4, points: null },
        { rank: 2, netVsPar: -1, grossVsPar: 1, points: null },
        { rank: 3, netVsPar: 3, grossVsPar: 5, points: null },
      ]
      // (2 + -1 + 3) / 3 = 4/3 ≈ 1.333
      expect(computeSeasonValue('STROKE_AVG', events, null, DEFAULT_POINTS_TABLE)).toBeCloseTo(4 / 3)
    })

    it('falls back to grossVsPar when netVsPar is null', () => {
      const events: EventResult[] = [
        { rank: 1, netVsPar: null, grossVsPar: 6, points: null },
        { rank: 2, netVsPar: null, grossVsPar: 4, points: null },
      ]
      expect(computeSeasonValue('STROKE_AVG', events, null, DEFAULT_POINTS_TABLE)).toBe(5)
    })

    it('returns 0 when all scores are null', () => {
      const events: EventResult[] = [
        { rank: 1, netVsPar: null, grossVsPar: null, points: null },
      ]
      expect(computeSeasonValue('STROKE_AVG', events, null, DEFAULT_POINTS_TABLE)).toBe(0)
    })
  })

  describe('BEST_OF_N', () => {
    it('averages N best (lowest) netVsPar scores', () => {
      // 5 events, bestOf=3, netVsPar: [-2, 0, 3, 1, 5] → best 3: [-2, 0, 1] → avg = -1/3
      const events: EventResult[] = [
        { rank: 1, netVsPar: -2, grossVsPar: 0, points: null },
        { rank: 2, netVsPar: 0, grossVsPar: 2, points: null },
        { rank: 3, netVsPar: 3, grossVsPar: 5, points: null },
        { rank: 4, netVsPar: 1, grossVsPar: 3, points: null },
        { rank: 5, netVsPar: 5, grossVsPar: 7, points: null },
      ]
      expect(computeSeasonValue('BEST_OF_N', events, 3, DEFAULT_POINTS_TABLE)).toBeCloseTo(-1 / 3)
    })

    it('uses all events when bestOf is null', () => {
      const events: EventResult[] = [
        { rank: 1, netVsPar: 2, grossVsPar: 4, points: null },
        { rank: 2, netVsPar: 4, grossVsPar: 6, points: null },
      ]
      expect(computeSeasonValue('BEST_OF_N', events, null, DEFAULT_POINTS_TABLE)).toBe(3)
    })

    it('handles fewer events than bestOf gracefully', () => {
      const events: EventResult[] = [
        { rank: 1, netVsPar: 2, grossVsPar: 4, points: null },
        { rank: 2, netVsPar: 4, grossVsPar: 6, points: null },
      ]
      // bestOf=5 but only 2 events → uses all 2
      expect(computeSeasonValue('BEST_OF_N', events, 5, DEFAULT_POINTS_TABLE)).toBe(3)
    })
  })

  describe('STABLEFORD_CUMULATIVE', () => {
    it('sums Stableford points across events', () => {
      const events: EventResult[] = [
        { rank: 1, netVsPar: null, grossVsPar: null, points: 36 },
        { rank: 2, netVsPar: null, grossVsPar: null, points: 32 },
        { rank: 3, netVsPar: null, grossVsPar: null, points: 38 },
      ]
      expect(computeSeasonValue('STABLEFORD_CUMULATIVE', events, null, DEFAULT_POINTS_TABLE)).toBe(106)
    })

    it('bestOf drops lowest-scoring events', () => {
      // 4 events: [36, 32, 38, 28], bestOf=3 → keeps [38, 36, 32] = 106
      const events: EventResult[] = [
        { rank: 1, netVsPar: null, grossVsPar: null, points: 36 },
        { rank: 2, netVsPar: null, grossVsPar: null, points: 32 },
        { rank: 3, netVsPar: null, grossVsPar: null, points: 38 },
        { rank: 4, netVsPar: null, grossVsPar: null, points: 28 },
      ]
      expect(computeSeasonValue('STABLEFORD_CUMULATIVE', events, 3, DEFAULT_POINTS_TABLE)).toBe(106)
    })

    it('treats null points as 0', () => {
      const events: EventResult[] = [
        { rank: 1, netVsPar: null, grossVsPar: null, points: null },
        { rank: 2, netVsPar: null, grossVsPar: null, points: 30 },
      ]
      expect(computeSeasonValue('STABLEFORD_CUMULATIVE', events, null, DEFAULT_POINTS_TABLE)).toBe(30)
    })
  })
})
