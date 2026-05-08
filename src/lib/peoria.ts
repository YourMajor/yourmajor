// Peoria handicap system — pure helpers (no prisma/pg) safe to import in client code.
//
// Rules summary:
//   - Pre-round, the organiser secretly picks 6 holes: 2 par-3, 2 par-4, 2 par-5,
//     drawing one from the front nine and one from the back nine for each par class.
//   - After the round, each player's strokes on those 6 holes are capped at 2×par,
//     summed, multiplied by 3 to project an 18-hole gross, course par is subtracted,
//     the result is multiplied by 0.80 and rounded, and finally clamped to [0, 36].
//   - Net score = Gross − Peoria handicap. Lowest net wins.
//
// The hole numbers stay hidden until every participant has finished the round;
// otherwise scoring on a known hole would tip off players. The leaderboard layer
// is responsible for the reveal gate — these helpers just compute the math.

export interface PeoriaHole {
  number: number
  par: number
}

/**
 * Pick the 6 secret holes for one round. The traditional rule wants one par-3,
 * one par-4, and one par-5 from each nine. Most courses satisfy that — when one
 * doesn't (rare unbalanced layouts), fall back to picking 2 of any par class
 * from the whole course, but still hold the 2-of-each invariant. Throws if the
 * course can't supply at least 2 holes of any par class.
 */
export function selectPeoriaHoles(holes: PeoriaHole[], rng: () => number = Math.random): number[] {
  const front = holes.filter((h) => h.number >= 1 && h.number <= 9)
  const back = holes.filter((h) => h.number >= 10 && h.number <= 18)

  const picked: number[] = []
  for (const par of [3, 4, 5] as const) {
    const frontByPar = front.filter((h) => h.par === par)
    const backByPar = back.filter((h) => h.par === par)
    if (frontByPar.length > 0 && backByPar.length > 0) {
      picked.push(pickOne(frontByPar, rng).number)
      picked.push(pickOne(backByPar, rng).number)
      continue
    }
    // Fallback: course doesn't have a par-N on both sides. Pick any 2 par-N holes
    // from the whole course; if there aren't even 2, throw — the format can't run.
    const anyByPar = holes.filter((h) => h.par === par)
    if (anyByPar.length < 2) {
      throw new Error(
        `Peoria selection failed: course has fewer than two par-${par} holes (found ${anyByPar.length}).`,
      )
    }
    const first = pickOne(anyByPar, rng)
    const remaining = anyByPar.filter((h) => h.number !== first.number)
    const second = pickOne(remaining, rng)
    picked.push(first.number, second.number)
  }
  // Sort ascending for stable display ordering.
  return picked.sort((a, b) => a - b)
}

/**
 * Compute the Peoria handicap for one round. Caller passes the sum of CAPPED
 * scores on the 6 secret holes (cap = 2 × par per hole) and the course par.
 *
 *   projectedGross = cappedSum × 3
 *   raw            = projectedGross − coursePar
 *   handicap       = round(raw × 0.80), clamped to [0, 36]
 */
export function computePeoriaHandicap(cappedSelectedSum: number, coursePar: number): number {
  const projectedGross = cappedSelectedSum * 3
  const raw = projectedGross - coursePar
  const adjusted = Math.round(raw * 0.8)
  return Math.max(0, Math.min(36, adjusted))
}

/**
 * Cap an individual hole score at 2 × par (Peoria's per-hole maximum applied
 * before computing the projected gross).
 */
export function cappedPeoriaScore(strokes: number, par: number): number {
  return Math.min(strokes, 2 * par)
}

/**
 * A round is "complete" for Peoria-reveal purposes when every active participant
 * has scored all 18 holes for that round. Until then, the secret hole numbers
 * stay hidden and net scores are not computed. Pass the full distinct-hole count
 * per player from already-loaded score rows.
 */
export function isPeoriaRoundComplete(
  scoredHolesByPlayer: Map<string, Set<number>>,
  participantIds: string[],
): boolean {
  if (participantIds.length === 0) return false
  for (const id of participantIds) {
    const played = scoredHolesByPlayer.get(id)
    if (!played || played.size < 18) return false
  }
  return true
}

function pickOne<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error('pickOne called on empty array')
  const idx = Math.floor(rng() * arr.length)
  return arr[Math.min(idx, arr.length - 1)]
}
