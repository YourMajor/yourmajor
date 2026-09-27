import { describe, it, expect, beforeEach, vi } from 'vitest'

// Second half of the Can I Get Your Number guard. The activation route now
// rejects an out-of-range number, but rows written before it did are already
// in the database — this pins that the override engine refuses to replace a
// recorded score with one of them.

let overrideRows: unknown[] = []

let scoredCounts: Record<string, number> = {}

const prismaMock = {
  playerPowerup: { findMany: vi.fn(async () => overrideRows) },
  tournamentRound: {
    findMany: vi.fn(async () => [{ id: 'round_1', course: { _count: { holes: 18 } } }]),
  },
  score: {
    groupBy: vi.fn(async () =>
      Object.entries(scoredCounts).map(([tournamentPlayerId, n]) => ({
        tournamentPlayerId,
        roundId: 'round_1',
        _count: { _all: n },
      })),
    ),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { buildStrokeOverrideMap, effectiveStrokes } = await import('@/lib/powerup-stroke-overrides')

const row = (numberValue: unknown) => ({
  tournamentPlayerId: 'tp_1',
  targetPlayerId: null,
  holeNumber: 3,
  metadata: { numberValue },
  powerup: { slug: 'can-i-get-your-number' },
})

const scores = [{ tournamentPlayerId: 'tp_1', holeNumber: 3, par: 4, strokes: 6, gir: false }]

beforeEach(() => {
  vi.clearAllMocks()
  overrideRows = []
  scoredCounts = {}
})

describe('buildStrokeOverrideMap — can-i-get-your-number', () => {
  it.each([[-500], [0], [21], [3.5], ['4'], [null], [undefined]])(
    'ignores a persisted numberValue of %p, leaving the recorded strokes',
    async (numberValue) => {
      overrideRows = [row(numberValue)]

      const map = await buildStrokeOverrideMap('tourn_1', scores)

      expect(map.has('tp_1:3')).toBe(false)
    },
  )

  it('applies a numberValue inside the legal hole-score range', async () => {
    overrideRows = [row(7)]

    const map = await buildStrokeOverrideMap('tourn_1', scores)

    expect(map.get('tp_1:3')).toBe(7)
  })

  it('applies the boundaries of the range', async () => {
    overrideRows = [row(1), { ...row(20), tournamentPlayerId: 'tp_2' }]

    const map = await buildStrokeOverrideMap('tourn_1', scores)

    expect(map.get('tp_1:3')).toBe(1)
    expect(map.get('tp_2:3')).toBe(20)
  })
})

describe('buildStrokeOverrideMap — parent-trap', () => {
  const swapRow = {
    tournamentPlayerId: 'tp_a',
    targetPlayerId: 'tp_b',
    roundId: 'round_1',
    holeNumber: 5,
    metadata: null,
    powerup: { slug: 'parent-trap' },
  }
  const swapScores = [
    { tournamentPlayerId: 'tp_a', holeNumber: 5, par: 4, strokes: 7, gir: false },
    { tournamentPlayerId: 'tp_b', holeNumber: 5, par: 4, strokes: 3, gir: true },
  ]

  it('holds the swap while either player is still mid-round', async () => {
    overrideRows = [swapRow]
    scoredCounts = { tp_a: 18, tp_b: 12 }

    const map = await buildStrokeOverrideMap('tourn_1', swapScores, 'round_1')

    expect(map.has('tp_a:round_1:5')).toBe(false)
    expect(map.has('tp_b:round_1:5')).toBe(false)
  })

  it('swaps the hole once both players have finished the round', async () => {
    overrideRows = [swapRow]
    scoredCounts = { tp_a: 18, tp_b: 18 }

    const map = await buildStrokeOverrideMap('tourn_1', swapScores, 'round_1')

    expect(map.get('tp_a:round_1:5')).toBe(3)
    expect(map.get('tp_b:round_1:5')).toBe(7)
  })

  it('swaps on the picked hole, not the activation hole', async () => {
    overrideRows = [{ ...swapRow, holeNumber: 9, metadata: { swapHoleNumber: 5 } }]
    scoredCounts = { tp_a: 18, tp_b: 18 }

    const map = await buildStrokeOverrideMap('tourn_1', swapScores, 'round_1')

    expect(map.get('tp_a:round_1:5')).toBe(3)
    expect(map.get('tp_b:round_1:5')).toBe(7)
    expect(map.has('tp_a:round_1:9')).toBe(false)
  })
})

describe('buildStrokeOverrideMap — multi-round tournaments', () => {
  const numberRow = {
    tournamentPlayerId: 'tp_1',
    targetPlayerId: null,
    roundId: 'round_1',
    holeNumber: 1,
    metadata: { numberValue: 3 },
    powerup: { slug: 'can-i-get-your-number' },
  }
  const twoRounds = [
    { tournamentPlayerId: 'tp_1', roundId: 'round_1', holeNumber: 1, par: 4, strokes: 6, gir: false },
    { tournamentPlayerId: 'tp_1', roundId: 'round_2', holeNumber: 1, par: 4, strokes: 5, gir: false },
  ]

  it('applies a round-1 override to round 1 only, not the same hole in round 2', async () => {
    overrideRows = [numberRow]
    const map = await buildStrokeOverrideMap('tourn_1', twoRounds)

    expect(effectiveStrokes(map, 'tp_1', 1, 6, 'round_1')).toBe(3)
    expect(effectiveStrokes(map, 'tp_1', 1, 5, 'round_2')).toBe(5)
  })

  it('reads the concede GIR from the powerup\'s own round', async () => {
    overrideRows = [{ ...numberRow, metadata: null, powerup: { slug: 'concede' } }]
    const scoresGirOnlyInRound2 = [
      { ...twoRounds[0], gir: false },
      { ...twoRounds[1], gir: true },
    ]
    const map = await buildStrokeOverrideMap('tourn_1', scoresGirOnlyInRound2)

    expect(effectiveStrokes(map, 'tp_1', 1, 6, 'round_1')).toBe(6)
    expect(effectiveStrokes(map, 'tp_1', 1, 5, 'round_2')).toBe(5)
  })

  it('still applies a legacy override with no round to every round', async () => {
    overrideRows = [{ ...numberRow, roundId: null }]
    const map = await buildStrokeOverrideMap('tourn_1', twoRounds)

    expect(effectiveStrokes(map, 'tp_1', 1, 6, 'round_1')).toBe(3)
    expect(effectiveStrokes(map, 'tp_1', 1, 5, 'round_2')).toBe(3)
  })
})
