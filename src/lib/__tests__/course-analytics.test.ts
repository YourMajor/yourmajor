/* eslint-disable @typescript-eslint/no-explicit-any -- the prisma mocks below
   stand in for three unrelated reads; typing each precisely buys nothing. */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// getCourseAnalytics was dead code when it was first surfaced on the season
// page, and shipping it as written would have published two wrong numbers:
//
//   - courseRecord had no completeness check, so a player three holes into
//     their round posted a "record" of 12 - and because it is the lowest total,
//     it beat every finished card on the course
//   - timesPlayed counted rounds nobody had entered a score for, which is also
//     what the courses are ranked by

type ScoreRow = {
  strokes: number
  tournamentPlayerId: string
  hole: { number: number; par: number }
  tournamentPlayer: { user: { name: string | null } }
}
type RoundRow = {
  courseId: string
  tournamentId: string
  course: { name: string; _count: { holes: number } }
  scores: ScoreRow[]
}

let rounds: RoundRow[] = []

// Loose return type: these three stand in for unrelated Prisma reads.
type Read = (a: unknown) => Promise<any>

const prismaMock = vi.hoisted(() => ({
  tournament: {
    findUnique: vi.fn<Read>(async () => ({ id: 'tourn_1', parentTournamentId: null })),
    findMany: vi.fn<Read>(async () => []),
  },
  tournamentRound: { findMany: vi.fn<Read>(async () => []) },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { getCourseAnalytics } from '@/lib/season-standings'

/** A 3-hole course so "complete" is cheap to express. */
function score(tp: string, name: string, hole: number, par: number, strokes: number): ScoreRow {
  return {
    strokes,
    tournamentPlayerId: tp,
    hole: { number: hole, par },
    tournamentPlayer: { user: { name } },
  }
}

function round(scores: ScoreRow[], holes = 3): RoundRow {
  return {
    courseId: 'course_1',
    tournamentId: 'tourn_1',
    course: { name: 'Pebble Creek', _count: { holes } },
    scores,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  rounds = []

  // getFullChain walks up, then down, then re-reads the chain.
  prismaMock.tournament.findUnique.mockResolvedValue({ id: 'tourn_1', parentTournamentId: null })
  prismaMock.tournament.findMany.mockImplementation(async (args: unknown) => {
    const a = args as { where?: { parentTournamentId?: unknown } }
    // The descendant walk; no children.
    if (a.where?.parentTournamentId) return []
    return [{ id: 'tourn_1', status: 'COMPLETED', name: 'Club Champs', startDate: new Date('2026-06-01') }]
  })
  prismaMock.tournamentRound.findMany.mockImplementation(async () => rounds)
})

describe('getCourseAnalytics — course record', () => {
  it('ignores a partial card, however low its total', () => {
    rounds = [
      round([
        // Finished: 4 + 4 + 4 = 12 over three holes.
        score('tp_full', 'Finisher', 1, 4, 4),
        score('tp_full', 'Finisher', 2, 4, 4),
        score('tp_full', 'Finisher', 3, 4, 4),
        // One hole in. Total 3 - lower than 12, and not a record.
        score('tp_part', 'Walked Off', 1, 4, 3),
      ]),
    ]

    return getCourseAnalytics('tourn_1').then(([course]) => {
      expect(course.courseRecord).toEqual({
        playerName: 'Finisher',
        total: 12,
        date: new Date('2026-06-01').toISOString(),
      })
    })
  })

  it('is null when nobody has finished a card', async () => {
    rounds = [round([score('tp_part', 'Walked Off', 1, 4, 3)])]

    const [course] = await getCourseAnalytics('tourn_1')
    expect(course.courseRecord).toBeNull()
    // The partial scores still count toward the hole averages.
    expect(course.holes).toHaveLength(1)
  })

  it('takes the lowest of several complete cards', async () => {
    rounds = [
      round([
        score('tp_a', 'A', 1, 4, 4),
        score('tp_a', 'A', 2, 4, 4),
        score('tp_a', 'A', 3, 4, 4),
        score('tp_b', 'B', 1, 4, 3),
        score('tp_b', 'B', 2, 4, 4),
        score('tp_b', 'B', 3, 4, 4),
      ]),
    ]

    const [course] = await getCourseAnalytics('tourn_1')
    expect(course.courseRecord).toMatchObject({ playerName: 'B', total: 11 })
  })
})

describe('getCourseAnalytics — timesPlayed', () => {
  it('does not count a round with no scores', async () => {
    rounds = [
      round([score('tp_a', 'A', 1, 4, 4), score('tp_a', 'A', 2, 4, 4), score('tp_a', 'A', 3, 4, 4)]),
      round([]),
      round([]),
    ]

    const [course] = await getCourseAnalytics('tourn_1')
    expect(course.timesPlayed).toBe(1)
  })

  it('omits a course entirely when none of its rounds were played', async () => {
    rounds = [round([]), round([])]

    expect(await getCourseAnalytics('tourn_1')).toEqual([])
  })
})

describe('getCourseAnalytics — hole metrics', () => {
  it('averages, rates and ranks by difficulty', async () => {
    rounds = [
      round([
        // Hole 1, par 4: a 3 (birdie) and a 5 (bogey) -> avg 4.0, +0.00
        score('tp_a', 'A', 1, 4, 3),
        score('tp_b', 'B', 1, 4, 5),
        // Hole 2, par 3: two 5s -> avg 5.0, +2.00, 100% bogey
        score('tp_a', 'A', 2, 3, 5),
        score('tp_b', 'B', 2, 3, 5),
      ]),
    ]

    const [course] = await getCourseAnalytics('tourn_1')
    const [h1, h2] = course.holes

    expect(h1).toMatchObject({ holeNumber: 1, avgScore: 4, avgVsPar: 0, birdieRate: 50, bogeyRate: 50 })
    expect(h2).toMatchObject({ holeNumber: 2, avgScore: 5, avgVsPar: 2, birdieRate: 0, bogeyRate: 100 })
    // Hardest first.
    expect(h2.hardestRank).toBe(1)
    expect(h1.hardestRank).toBe(2)
  })
})
