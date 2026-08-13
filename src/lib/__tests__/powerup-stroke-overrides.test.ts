import { describe, it, expect, beforeEach, vi } from 'vitest'

// Second half of the Can I Get Your Number guard. The activation route now
// rejects an out-of-range number, but rows written before it did are already
// in the database — this pins that the override engine refuses to replace a
// recorded score with one of them.

let overrideRows: unknown[] = []

const prismaMock = {
  playerPowerup: { findMany: vi.fn(async () => overrideRows) },
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { buildStrokeOverrideMap } = await import('@/lib/powerup-stroke-overrides')

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
