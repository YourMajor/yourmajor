// Pure utility functions safe to import in client components (no prisma/pg)

export interface HoleResult {
  holeNumber: number
  par: number
  strokes: number | null
  diff: number | null   // strokes vs par
  roundNumber?: number
}

export interface PlayerStanding {
  rank: number
  tournamentPlayerId: string
  playerName: string
  avatarUrl: string | null
  handicap: number
  holesPlayed: number
  grossTotal: number | null
  netTotal: number | null
  grossVsPar: number | null
  netVsPar: number | null
  todayTotal: number | null
  points: number | null
  roundTotals: Record<number, number>
  holes: HoleResult[]
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
