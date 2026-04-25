// CLIENT-SAFE pure helpers for auto-assigning players into groups.
// No prisma/pg imports — server actions and tests can both consume this.

export interface AssignablePlayer {
  id: string
  userId: string
  name: string
  handicap: number
}

export type AssignMode = 'RANDOM' | 'BALANCED' | 'TIGHT'

/**
 * Fisher-Yates shuffle. Returns a new array; does not mutate input.
 * Pass a seeded RNG for deterministic output (tests).
 */
export function shuffleFisherYates<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Make a deterministic seeded RNG (mulberry32). Useful for tests.
 */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return function () {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function chunkBySize<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

/**
 * RANDOM mode — Fisher-Yates shuffle then chunk into groupSize-sized buckets.
 * Last group may be undersized if roster doesn't divide evenly.
 */
export function assignRandom(
  players: readonly AssignablePlayer[],
  groupSize: number,
  rng: () => number = Math.random,
): AssignablePlayer[][] {
  return chunkBySize(shuffleFisherYates(players, rng), groupSize)
}

/**
 * BALANCED mode — sort by handicap ascending, then snake-distribute across groups
 * so each group has a mix of low / high handicaps.
 *
 * Example with 12 players (h=1..12) into 3 groups of 4:
 *   sorted: [1,2,3,4,5,6,7,8,9,10,11,12]
 *   group 1: 1,6,7,12   (cols 0,5,6,11)
 *   group 2: 2,5,8,11
 *   group 3: 3,4,9,10
 */
export function snakeDraftByHandicap(
  players: readonly AssignablePlayer[],
  groupSize: number,
): AssignablePlayer[][] {
  if (players.length === 0) return []
  const groupCount = Math.max(1, Math.ceil(players.length / groupSize))
  const sorted = players.slice().sort((a, b) => a.handicap - b.handicap)
  const groups: AssignablePlayer[][] = Array.from({ length: groupCount }, () => [])

  let idx = 0
  let row = 0
  while (idx < sorted.length) {
    const goingForward = row % 2 === 0
    for (let i = 0; i < groupCount && idx < sorted.length; i++) {
      const col = goingForward ? i : groupCount - 1 - i
      groups[col].push(sorted[idx++])
    }
    row++
  }
  return groups
}

/**
 * TIGHT mode — flight by handicap. Sort ascending then chunk consecutively
 * so each group has similar skill levels (a "flight").
 */
export function flightByHandicap(
  players: readonly AssignablePlayer[],
  groupSize: number,
): AssignablePlayer[][] {
  return chunkBySize(
    players.slice().sort((a, b) => a.handicap - b.handicap),
    groupSize,
  )
}

/**
 * Greedy partner-avoidance assignment. For each open seat, pick the unassigned
 * player with the fewest collisions against already-seated members in that group;
 * ties break toward handicap balance (lowest abs difference from current group avg).
 *
 * `recentPartners` maps userId → set of userIds played with in the prior event.
 * Returns the resulting groups plus a count of unavoidable collisions.
 */
export function assignWithPartnerAvoidance(
  players: readonly AssignablePlayer[],
  groupSize: number,
  recentPartners: Record<string, ReadonlySet<string>>,
  baseMode: AssignMode = 'BALANCED',
  rng: () => number = Math.random,
): { groups: AssignablePlayer[][]; conflicts: number } {
  if (players.length === 0) return { groups: [], conflicts: 0 }

  const groupCount = Math.max(1, Math.ceil(players.length / groupSize))
  const seedSeats: AssignablePlayer[][] =
    baseMode === 'BALANCED'
      ? snakeDraftByHandicap(players, groupSize)
      : baseMode === 'TIGHT'
        ? flightByHandicap(players, groupSize)
        : assignRandom(players, groupSize, rng)

  // Use the seed only to pick *initial* anchors per group (one player each),
  // then re-fill remaining seats greedily honouring avoidance.
  const groups: AssignablePlayer[][] = Array.from({ length: groupCount }, () => [])
  const remaining = new Set(players.map((p) => p.id))

  for (let i = 0; i < groupCount; i++) {
    const anchor = seedSeats[i]?.[0]
    if (anchor) {
      groups[i].push(anchor)
      remaining.delete(anchor.id)
    }
  }

  let conflicts = 0
  const playerById = new Map(players.map((p) => [p.id, p]))

  // Fill seats round-robin so no group gets all the leftovers.
  let cursor = 0
  while (remaining.size > 0) {
    let assigned = false
    for (let step = 0; step < groupCount && remaining.size > 0; step++) {
      const groupIdx = (cursor + step) % groupCount
      const group = groups[groupIdx]
      if (group.length >= groupSize) continue

      const candidates = [...remaining].map((id) => playerById.get(id)!)
      const ranked = candidates
        .map((c) => {
          const collisions = group.reduce((acc, seated) => {
            const cPartners = recentPartners[c.userId]
            const seatedPartners = recentPartners[seated.userId]
            const collision = cPartners?.has(seated.userId) || seatedPartners?.has(c.userId)
            return acc + (collision ? 1 : 0)
          }, 0)
          const avg = group.length === 0 ? c.handicap : group.reduce((s, p) => s + p.handicap, 0) / group.length
          const handicapDist = Math.abs(c.handicap - avg)
          return { c, collisions, handicapDist }
        })
        .sort((a, b) => a.collisions - b.collisions || a.handicapDist - b.handicapDist)

      const pick = ranked[0]
      if (!pick) continue
      conflicts += pick.collisions
      group.push(pick.c)
      remaining.delete(pick.c.id)
      assigned = true
    }
    if (!assigned) break
    cursor = (cursor + 1) % groupCount
  }

  return { groups, conflicts }
}

/**
 * Main entrypoint. Selects the algorithm based on mode + whether avoidance is on.
 */
export function autoAssign(
  players: readonly AssignablePlayer[],
  mode: AssignMode,
  groupSize: number,
  options: {
    avoidLastEventPartners?: boolean
    recentPartners?: Record<string, ReadonlySet<string>>
    rng?: () => number
  } = {},
): { groups: AssignablePlayer[][]; conflicts: number } {
  const rng = options.rng ?? Math.random
  if (options.avoidLastEventPartners && options.recentPartners) {
    return assignWithPartnerAvoidance(players, groupSize, options.recentPartners, mode, rng)
  }
  switch (mode) {
    case 'RANDOM':
      return { groups: assignRandom(players, groupSize, rng), conflicts: 0 }
    case 'BALANCED':
      return { groups: snakeDraftByHandicap(players, groupSize), conflicts: 0 }
    case 'TIGHT':
      return { groups: flightByHandicap(players, groupSize), conflicts: 0 }
  }
}
