// Pure utility functions safe to import in client components (no prisma/pg)

export interface HoleResult {
  holeNumber: number
  par: number
  strokes: number | null
  diff: number | null   // strokes vs par
  roundNumber?: number
}

/**
 * Discriminator on PlayerStanding so the leaderboard UI can render format-aware
 * rows (team chips for Scramble, W-L-H for match play, etc) instead of falling
 * back to a stroke-play heuristic.
 *
 * Phase 1 introduces the discriminator and per-kind extension fields. The legacy
 * `points` / `playerName` / `tournamentPlayerId` fields stay populated for
 * backward compat — Phase 6 drops them.
 */
export type StandingKind =
  | 'stroke'         // STROKE_PLAY, STROKE_PLAY_NET, CALLAWAY, PEORIA
  | 'low-gross-net'  // LOW_GROSS_LOW_NET (dual rank)
  | 'stableford'     // STABLEFORD, MODIFIED_STABLEFORD
  | 'quota'          // QUOTA
  | 'skins'          // SKINS, SKINS_GROSS, SKINS_NET
  | 'match'          // MATCH_PLAY, RYDER_CUP
  | 'team-stroke'    // SCRAMBLE, SHAMBLE, CHAPMAN, PINEHURST
  | 'team-best-ball' // BEST_BALL, BEST_BALL_2, BEST_BALL_4
  | 'nassau'         // NASSAU (added in Phase 5)

export interface MatchRecord {
  won: number
  lost: number
  halved: number
}

export type MatchStatus = 'live' | 'AS' | 'closed' | 'dormie' | 'final'

export interface SkinsHoleAttribution {
  round: number
  hole: number
  /** Number of skins claimed on this hole (1 + accumulated carry). */
  carryover: number
}

export interface PlayerStanding {
  /** Format-aware discriminator. Default 'stroke' for legacy callers. */
  kind: StandingKind

  rank: number
  /** Row identity. Individual rows: tournamentPlayerId. Team rows: team.id. */
  tournamentPlayerId: string
  /** Display name. Individual rows: player name. Team rows: team name. */
  playerName: string
  avatarUrl: string | null
  handicap: number
  holesPlayed: number
  grossTotal: number | null
  netTotal: number | null
  grossVsPar: number | null
  netVsPar: number | null
  todayTotal: number | null
  /**
   * @deprecated Use kind-specific fields. Populated for stableford
   * (= stablefordPoints), match (= holesUp), skins (= skinsWon × skinsValue),
   * quota (= quotaOverUnder). Kept for one release while consumers migrate.
   */
  points: number | null
  roundTotals: Record<number, number>
  holes: HoleResult[]

  // ─── Per-kind extensions (presence governed by `kind`) ─────────────────────
  // stableford
  stablefordPoints?: number
  // quota
  quotaTarget?: number
  quotaEarned?: number
  quotaOverUnder?: number
  // skins
  skinsWon?: number
  skinsValue?: number
  skinsHoles?: SkinsHoleAttribution[]
  /**
   * Skins waiting on the next hole because the most-recently-played hole
   * tied. Same value populated on every skins-kind row in a given standings
   * snapshot — it's a tournament-level fact, not per-player.
   */
  skinsTrailingCarryover?: number
  // match
  matchRecord?: MatchRecord
  holesUp?: number
  through?: number
  matchStatus?: MatchStatus
  opponentId?: string
  // team-stroke / team-best-ball
  teamId?: string
  teamName?: string
  teamColor?: string | null
  memberIds?: string[]
  captainId?: string
  /** Full member details (name + avatar) to render member chips. */
  teamMembers?: Array<{ tournamentPlayerId: string; name: string; avatarUrl: string | null }>
  // nassau
  front?: { holesUp: number; thru: number }
  back?: { holesUp: number; thru: number }
  overall?: { holesUp: number; thru: number }
  // low-gross-net (dual ranking)
  grossRank?: number
  netRank?: number
  // peoria: only populated for rounds that are complete (every participant scored
  // all 18 holes). The leaderboard treats presence of an entry as "reveal this
  // round's secret holes + handicap"; absence means "still hidden".
  peoriaRoundDetails?: Record<number, {
    secretHoles: number[]
    peoriaHandicap: number
  }>
}

export function scoreName(diff: number | null): string {
  if (diff === null) return ''
  if (diff <= -2) return 'Eagle'
  if (diff === -1) return 'Birdie'
  if (diff === 0) return 'Par'
  if (diff === 1) return 'Bogey'
  if (diff === 2) return 'Double'
  return `+${diff}`
}

export function scoreClass(diff: number | null): string {
  if (diff === null) return ''
  if (diff <= -2) return 'score-eagle'
  if (diff === -1) return 'score-birdie'
  if (diff === 0) return 'score-par'
  if (diff === 1) return 'score-bogey'
  return 'score-double'
}

export function formatVsPar(n: number | null): string {
  if (n === null) return '—'
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : `${n}`
}

export function allocateHandicapStrokes(
  handicap: number,
  holes: Array<{ number: number; handicap: number | null }>
): Set<number> {
  const strokes = new Set<number>()
  if (handicap <= 0) return strokes

  const sorted = [...holes].sort((a, b) => {
    const ai = a.handicap ?? 999
    const bi = b.handicap ?? 999
    return ai - bi
  })

  const courseHoles = sorted.length || 18
  const fullRounds = Math.floor(handicap / courseHoles)
  const remainder = handicap % courseHoles

  for (let round = 0; round < fullRounds; round++) {
    for (const h of sorted) strokes.add(h.number)
  }
  for (let i = 0; i < remainder && i < sorted.length; i++) {
    strokes.add(sorted[i].number)
  }

  return strokes
}

// ─── Callaway Handicap System ────────────────────────────────────────────────

/**
 * Callaway deduction table:
 *   71 or less: No handicap
 *   72-74:  1/2 worst hole     80-84:  1 1/2 worst holes
 *   75-79:  1 worst hole       85-89:  2 worst holes
 *   ...continues in 5-score increments up to 125-129: 6 worst holes
 */
const CALLAWAY_TABLE: Array<[number, number, number]> = [
  [72, 74, 1], [75, 79, 2], [80, 84, 3], [85, 89, 4], [90, 94, 5], [95, 99, 6],
  [100, 104, 7], [105, 109, 8], [110, 114, 9], [115, 119, 10], [120, 124, 11],
  [125, 129, 12], [130, 999, 12],
]

/**
 * Callaway adjustment by column position:
 *   Col 1 (-2): 72, 75, 80, 85, 90, ...
 *   Col 2 (-1): 73, 76, 81, 86, 91, ...
 *   Col 3 ( 0): 74, 77, 82, 87, 92, ...
 *   Col 4 (+1): 78, 83, 88, 93, 98, ...
 *   Col 5 (+2): 79, 84, 89, 94, 99, ...
 */
export function getCallawayAdjustment(gross: number): number {
  if (gross <= 71) return 0
  if (gross <= 74) return [-2, -1, 0][gross - 72]
  const adjustments = [-2, -1, 0, 1, 2]
  const offset = ((gross - 75) % 5 + 5) % 5
  return adjustments[offset]
}

export function callawayDeduction(
  gross: number,
  scores: Array<{ strokes: number; par: number; holeNumber: number }>
): number {
  if (gross <= 71) return 0

  const eligible = scores
    .filter((s) => s.holeNumber <= 16)
    .map((s) => ({ strokes: Math.min(s.strokes, s.par * 2), holeNumber: s.holeNumber }))
    .sort((a, b) => b.strokes - a.strokes)

  const tableRow = CALLAWAY_TABLE.find(([min, max]) => gross >= min && gross <= max)
  const halfHoles = tableRow ? tableRow[2] : 12
  const fullHoles = Math.floor(halfHoles / 2)
  const hasHalf = halfHoles % 2 === 1

  let deduction = 0
  for (let i = 0; i < fullHoles && i < eligible.length; i++) {
    deduction += eligible[i].strokes
  }
  if (hasHalf && eligible[fullHoles] !== undefined) {
    deduction += Math.floor(eligible[fullHoles].strokes / 2)
  }

  const adjustment = getCallawayAdjustment(gross)
  return Math.max(0, deduction + adjustment)
}

export { CALLAWAY_TABLE }

// ─── Format Helpers ──────────────────────────────────────────────────────────
// Pure helpers consumed by per-format scoring strategies.
// CLIENT-SAFE — no prisma/pg.

export interface StablefordPointsTable {
  eagle: number
  birdie: number
  par: number
  bogey: number
  doubleOrWorse: number
}

export const STABLEFORD_DEFAULT: StablefordPointsTable = {
  eagle: 4,
  birdie: 3,
  par: 2,
  bogey: 1,
  doubleOrWorse: 0,
}

export const MODIFIED_STABLEFORD_DEFAULT: StablefordPointsTable = {
  eagle: 5,
  birdie: 2,
  par: 0,
  bogey: -1,
  doubleOrWorse: -3,
}

/**
 * Stableford points for a single hole.
 *  diff = strokes - (par + handicapStrokesOnHole)
 */
export function stablefordPoints(
  diff: number,
  table: StablefordPointsTable = STABLEFORD_DEFAULT,
): number {
  if (diff <= -2) return table.eagle
  if (diff === -1) return table.birdie
  if (diff === 0) return table.par
  if (diff === 1) return table.bogey
  return table.doubleOrWorse
}

/**
 * Quota target for a player.
 * Conventional formula: 36 - course handicap (capped at 0).
 */
export function quotaTarget(handicap: number): number {
  return Math.max(0, Math.round(36 - handicap))
}

/**
 * Quota points earned on a single hole. Conventional table:
 *   eagle 8, birdie 4, par 2, bogey 1, double-or-worse 0
 */
export function quotaPointsFor(
  diff: number,
  table: StablefordPointsTable = { eagle: 8, birdie: 4, par: 2, bogey: 1, doubleOrWorse: 0 },
): number {
  return stablefordPoints(diff, table)
}

/**
 * Skins per hole. A skin is awarded only when a player has the strictly-lowest
 * score on a hole. Ties carry over to the next hole when carryOver=true.
 *
 * Returns:
 *   - wins: tournamentPlayerId → number of skins won
 *   - outcomes: per-hole record (winnerId, skinsAwarded) so the UI can render a
 *     per-hole breakdown and detect a trailing carryover.
 */
export interface SkinsHoleInput {
  round: number
  hole: number
  scores: Array<{ tournamentPlayerId: string; strokes: number | null }>
}

export interface SkinsHoleOutcome {
  round: number
  hole: number
  winnerId: string | null   // null when the hole tied (and the skins carried)
  carryEntering: number     // skins carried INTO this hole from prior ties
  skinsAwarded: number      // 0 if tied; otherwise 1 + carryEntering
}

export function skinsPerHole(
  holes: SkinsHoleInput[],
  carryOver = true,
): { wins: Record<string, number>; outcomes: SkinsHoleOutcome[] } {
  const wins: Record<string, number> = {}
  const outcomes: SkinsHoleOutcome[] = []
  let carry = 0

  for (const h of holes) {
    const playable = h.scores.filter((s) => s.strokes !== null) as Array<{ tournamentPlayerId: string; strokes: number }>
    if (playable.length === 0) continue
    const lowest = Math.min(...playable.map((s) => s.strokes))
    const lowestPlayers = playable.filter((s) => s.strokes === lowest)
    if (lowestPlayers.length === 1) {
      const id = lowestPlayers[0].tournamentPlayerId
      const awarded = 1 + carry
      wins[id] = (wins[id] ?? 0) + awarded
      outcomes.push({ round: h.round, hole: h.hole, winnerId: id, carryEntering: carry, skinsAwarded: awarded })
      carry = 0
    } else if (carryOver) {
      outcomes.push({ round: h.round, hole: h.hole, winnerId: null, carryEntering: carry, skinsAwarded: 0 })
      carry += 1
    } else {
      outcomes.push({ round: h.round, hole: h.hole, winnerId: null, carryEntering: carry, skinsAwarded: 0 })
      carry = 0
    }
  }
  return { wins, outcomes }
}

/**
 * Best ball: per hole, take the lowest player score in the team.
 * Returns the team's hole-by-hole effective score (or null if no player has scored that hole).
 */
export function bestBallSelect(
  teamHoleScores: Array<Array<number | null>>,
): Array<number | null> {
  return teamHoleScores.map((hole) => {
    const valid = hole.filter((s): s is number => s !== null)
    return valid.length === 0 ? null : Math.min(...valid)
  })
}

/**
 * Match play status from a sequence of hole results.
 * holeWinners: +1 if A wins, -1 if B wins, 0 halved.
 *
 * Status precedence (highest first):
 *   final  — every scheduled hole has been played
 *   closed — leader's margin exceeds remaining holes (match cannot be reversed)
 *   dormie — leader's margin equals remaining holes
 *   AS     — through some holes but currently all-square
 *   live   — match is in progress and one side is ahead
 *
 * If `closed` triggers mid-card, `through` is fixed at the closing hole and
 * remaining holes are ignored.
 */
export function matchPlayStatus(
  holeWinners: number[],
  totalHoles = 18,
): {
  up: number
  through: number
  closed: boolean
  status: 'live' | 'AS' | 'closed' | 'dormie' | 'final'
} {
  let lead = 0
  let through = 0
  for (const r of holeWinners) {
    lead += r
    through += 1
    const remaining = totalHoles - through
    if (Math.abs(lead) > remaining) {
      return { up: lead, through, closed: true, status: 'closed' }
    }
  }
  const remaining = totalHoles - through
  if (through === totalHoles) return { up: lead, through, closed: false, status: 'final' }
  if (through === 0) return { up: 0, through: 0, closed: false, status: 'live' }
  if (Math.abs(lead) === remaining && remaining > 0) {
    return { up: lead, through, closed: false, status: 'dormie' }
  }
  if (lead === 0) return { up: 0, through, closed: false, status: 'AS' }
  return { up: lead, through, closed: false, status: 'live' }
}

