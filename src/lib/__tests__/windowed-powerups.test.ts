/**
 * The generic windowed-card engine.
 *
 * Two jobs here:
 *
 * 1. PARITY. Five live cards moved off hand-written per-slug evaluators onto
 *    this engine (Birdie Hunter, Stayin' Alive, One-Putt Wonder, Foot Wedge,
 *    Double or Nothing). Each `parity:` test pins the payout the OLD evaluator
 *    produced, so a refactor that changes what a player earns fails here.
 *
 * 2. The engine's own rules — predicates, the three banking modes, window
 *    extension, and the bounds.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

interface FakeScore {
  strokes: number | null
  putts?: number | null
  fairwayHit?: boolean | null
  gir?: boolean | null
  hole: { number: number; par: number }
}

let scoreRows: FakeScore[] = []
let updated: Record<string, unknown> | null = null
let resolvedWith: { status?: string; scoreModifier?: number | null } | null = null

const prismaMock = {
  score: { findMany: vi.fn(async () => scoreRows) },
  playerPowerup: {
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if ('status' in data) resolvedWith = data as typeof resolvedWith
      else updated = data.metadata as Record<string, unknown>
      return {}
    }),
    findMany: vi.fn(async () => []),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { evaluateWindowedPowerup, HOLE_PREDICATES } = await import('@/lib/variable-powerup-evaluator')
const { buildWindowMetadata, powerupEffectSchema } = await import('@/lib/powerup-engine')
import type { PowerupEffect } from '@/lib/powerup-engine'

/** A windowed effect, validated through the real schema so a test can't
 *  describe a card the engine would reject. */
function effect(
  scoring: Partial<PowerupEffect['scoring']> & { conditionalKey: string },
  duration: number,
  extra?: Partial<PowerupEffect>,
): PowerupEffect {
  return powerupEffectSchema.parse({
    scoring: { mode: 'windowed', modifier: -1, bank: 'sum', ...scoring },
    duration,
    requiresTarget: false,
    input: null,
    restrictions: { excludePar3: false },
    flavorText: 't',
    ...extra,
  })
}

/** Holes 2..N+1 with the given (strokes, par) pairs — i.e. played after an
 *  activation on hole 1. */
function holes(...specs: Array<[strokes: number, par: number] | [number, number, { putts?: number; gir?: boolean; fairwayHit?: boolean }]>): FakeScore[] {
  return specs.map((s, i) => ({
    strokes: s[0],
    par: s[1],
    putts: (s[2] as { putts?: number } | undefined)?.putts ?? null,
    gir: (s[2] as { gir?: boolean } | undefined)?.gir ?? null,
    fairwayHit: (s[2] as { fairwayHit?: boolean } | undefined)?.fairwayHit ?? null,
    hole: { number: i + 2, par: s[1] },
  })) as FakeScore[]
}

async function run(
  e: PowerupEffect,
  rows: FakeScore[],
  opts?: { finalize?: boolean; targetPlayerIds?: string[] },
) {
  scoreRows = rows
  const meta = buildWindowMetadata(e, 1, opts?.targetPlayerIds ? { selectedPlayerIds: opts.targetPlayerIds } : null)
  return evaluateWindowedPowerup('pp_1', 'slug', 'Card', e, 'tp_me', 'round_1', meta, {
    finalize: opts?.finalize,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  scoreRows = []
  updated = null
  resolvedWith = null
})

// ─── 1. Parity with the retired per-slug evaluators ──────────────────────────

describe('parity: Birdie Hunter (was birdie_bonus_3, window 3)', () => {
  const card = effect({ conditionalKey: 'birdie_bonus', modifier: -1, bank: 'sum' }, 3)

  it('pays -1 per birdie across a full 3-hole window', async () => {
    // 2 birdies + 1 par → -2, exactly what the old evaluator banked.
    const r = await run(card, holes([3, 4], [4, 4], [4, 5]))
    expect(r.outcome).toBe('success')
    expect(r.scoreModifier).toBe(-2)
  })

  it('pays nothing when the window has no birdies', async () => {
    const r = await run(card, holes([4, 4], [5, 4], [6, 5]))
    expect(r.outcome).toBe('failed')
    expect(r.scoreModifier).toBe(0)
  })

  it('keeps the partial bank when the round ends mid-window', async () => {
    // Old finalize paid meta.bonusStrokes, i.e. the partial bank. Same here.
    const r = await run(card, holes([3, 4]), { finalize: true })
    expect(r.scoreModifier).toBe(-1)
  })

  it('reports progress while the window is still open', async () => {
    const r = await run(card, holes([3, 4]))
    expect(r.outcome).toBe('in_progress')
    expect(r.scoreModifier).toBeNull()
    expect(updated).toMatchObject({ holesRemaining: 2, tally: 1, banked: -1 })
  })
})

describe("parity: Stayin' Alive (was bogey_free_3, window 3, flat -3)", () => {
  const card = effect({ conditionalKey: 'bogey_free', modifier: -1, bank: 'streak' }, 3)

  it('pays -3 for three bogey-free holes', async () => {
    const r = await run(card, holes([4, 4], [3, 4], [5, 5]))
    expect(r.outcome).toBe('success')
    expect(r.scoreModifier).toBe(-3)
  })

  it('pays nothing the moment a bogey lands', async () => {
    const r = await run(card, holes([4, 4], [5, 4], [5, 5]))
    expect(r.outcome).toBe('failed')
    expect(r.scoreModifier).toBe(0)
    expect(r.message).toContain('hole 3')
  })

  it('pays nothing if the round ends before the window fills', async () => {
    // The old evaluator required holesScored >= 3; a 'streak' bank reproduces
    // that all-or-nothing rule. This is why Stayin' Alive is not 'sum'.
    const r = await run(card, holes([4, 4], [4, 4]), { finalize: true })
    expect(r.scoreModifier).toBe(0)
  })
})

describe('parity: One-Putt Wonder (was one_putt_streak, window 9)', () => {
  const card = effect({ conditionalKey: 'one_putt', modifier: -1, bank: 'sum' }, 9)

  it('pays -1 per one-putt over nine holes', async () => {
    const rows = holes(
      [4, 4, { putts: 1 }], [4, 4, { putts: 2 }], [4, 4, { putts: 1 }],
      [4, 4, { putts: 3 }], [4, 4, { putts: 1 }], [4, 4, { putts: 2 }],
      [5, 5, { putts: 2 }], [3, 3, { putts: 1 }], [4, 4, { putts: 2 }],
    )
    const r = await run(card, rows)
    expect(r.scoreModifier).toBe(-4)
  })

  it('ignores holes with no putt data rather than crediting them', async () => {
    const r = await run(card, holes([4, 4], [4, 4]), { finalize: true })
    expect(r.scoreModifier).toBe(0)
  })
})

describe('parity: Foot Wedge (was foot_wedge_window, window 9, never pays)', () => {
  const card = effect({ conditionalKey: 'none', modifier: 0, bank: 'none' }, 9)

  it('resolves at zero once the window completes', async () => {
    const rows = holes(...Array.from({ length: 9 }, () => [4, 4] as [number, number]))
    const r = await run(card, rows)
    expect(r.outcome).toBe('success')
    expect(r.scoreModifier).toBe(0)
  })

  it('counts down without ever banking a modifier', async () => {
    const r = await run(card, holes([4, 4], [7, 4]))
    expect(r.outcome).toBe('in_progress')
    expect(r.message).toContain('7 holes remaining')
    expect(updated).toMatchObject({ banked: 0 })
  })
})

describe('parity: Double or Nothing (was score_double_3, window 3, signed)', () => {
  const card = effect({ conditionalKey: 'score_double', modifier: 1, bank: 'sum' }, 3)

  it('sums the target\'s score-to-par across the window', async () => {
    // +1, +2, -1 → net +2 onto the opponent, as the old netDelta did.
    const r = await run(card, holes([5, 4], [6, 4], [4, 5]))
    expect(r.scoreModifier).toBe(2)
  })

  it('can come out negative, helping the target', async () => {
    const r = await run(card, holes([3, 4], [3, 4], [4, 5]))
    expect(r.scoreModifier).toBe(-3)
  })
})

// ─── 2. The engine's own rules ───────────────────────────────────────────────

describe('banking modes', () => {
  it("'wipe' discards the bank on a failing hole", async () => {
    // Par Train: banks -1 a par, then a double bogey derails it.
    const card = effect({ conditionalKey: 'par_or_better', modifier: -1, bank: 'wipe' }, 5)
    const r = await run(card, holes([4, 4], [4, 4], [6, 4]))
    expect(r.outcome).toBe('failed')
    expect(r.scoreModifier).toBe(0)
  })

  it("'wipe' keeps the bank when the round simply runs out", async () => {
    const card = effect({ conditionalKey: 'par_or_better', modifier: -1, bank: 'wipe' }, 5)
    const r = await run(card, holes([4, 4], [4, 4]), { finalize: true })
    expect(r.scoreModifier).toBe(-2)
  })

  it("'sum' keeps what was banked before a failure", async () => {
    const card = effect({ conditionalKey: 'par_or_better', modifier: -1, bank: 'sum' }, 5)
    const r = await run(card, holes([4, 4], [4, 4], [6, 4]))
    expect(r.scoreModifier).toBe(-2)
  })
})

describe('window extension (The Hot Hand)', () => {
  const card = effect({ conditionalKey: 'beat_previous_hole', modifier: -1, bank: 'sum' }, 3)

  it('lengthens the window on each improving hole', async () => {
    // Hole 2 is the baseline (no previous), then 3 improving holes each pay
    // -1 and add a hole, so a 3-hole window stretches past its nominal end.
    const r = await run(card, holes([6, 4], [5, 4], [4, 4], [3, 4]))
    expect(r.outcome).toBe('in_progress')
    expect(updated).toMatchObject({ banked: -3 })
  })

  it('stops extending once the player stops improving', async () => {
    // Hole 2 is the baseline. Hole 3 improves (+2 → +1): pays -1 and stretches
    // the window from 3 to 4. Holes 4 and 5 do not improve, so the window ends
    // at its stretched length with one payout banked.
    const r = await run(card, holes([6, 4], [5, 4], [5, 4], [5, 4]))
    expect(r.outcome).toBe('success')
    expect(r.scoreModifier).toBe(-1)
  })

  it('is still open while an earned extension has holes left', async () => {
    const r = await run(card, holes([6, 4], [5, 4], [5, 4]))
    expect(r.outcome).toBe('in_progress')
    expect(updated).toMatchObject({ holesRemaining: 1, banked: -1 })
  })

  it('never grows a window past the holes on a course', async () => {
    const rows = holes(...Array.from({ length: 18 }, (_, i) => [20 - i, 4] as [number, number]))
    const r = await run(card, rows)
    // Every hole improves, so extension is capped rather than unbounded.
    expect(r.scoreModifier).toBeGreaterThanOrEqual(-20)
  })
})

describe('attacks track the victim, not the activator', () => {
  it('reads the target player\'s scores when the card requires a target', async () => {
    const card = effect(
      { conditionalKey: 'over_par_drain', modifier: 1, bank: 'sum' },
      4,
      { requiresTarget: true },
    )
    const r = await run(card, holes([6, 4], [5, 4], [4, 4], [4, 4]), {
      targetPlayerIds: ['tp_victim'],
    })

    // +2 then +1 over par → +3 onto the victim.
    expect(r.scoreModifier).toBe(3)
    expect(prismaMock.score.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tournamentPlayerId: 'tp_victim' }),
      }),
    )
  })
})

describe('bounds and bad data', () => {
  it('refuses to pay out for a predicate that does not exist', async () => {
    const card = effect({ conditionalKey: 'no_such_rule', modifier: -5, bank: 'sum' }, 3)
    const r = await run(card, holes([3, 4], [3, 4], [3, 4]))
    expect(r.outcome).toBe('failed')
    expect(r.scoreModifier).toBe(0)
    expect(r.message).toContain('unknown rule')
  })

  it('clamps a runaway bank to the legal stroke range', async () => {
    const card = effect({ conditionalKey: 'birdie_bonus', modifier: -5, bank: 'sum' }, 18)
    const rows = holes(...Array.from({ length: 18 }, () => [1, 5] as [number, number]))
    const r = await run(card, rows)
    // 18 birdies x -5 = -90, clamped to the -20 bound.
    expect(r.scoreModifier).toBe(-20)
  })

  it('skips holes with no strokes recorded', async () => {
    const card = effect({ conditionalKey: 'birdie_bonus', modifier: -1, bank: 'sum' }, 3)
    scoreRows = [
      { strokes: null, hole: { number: 2, par: 4 } },
      { strokes: 3, hole: { number: 3, par: 4 } },
    ]
    const meta = buildWindowMetadata(card, 1, null)
    const r = await evaluateWindowedPowerup('pp_1', 'slug', 'Card', card, 'tp_me', 'round_1', meta)
    expect(r.outcome).toBe('in_progress')
    expect(updated).toMatchObject({ banked: -1, holesRemaining: 2 })
  })
})

describe('buildWindowMetadata', () => {
  it('seeds holesRemaining from the card\'s own duration', () => {
    const card = effect({ conditionalKey: 'none' }, 6)
    expect(buildWindowMetadata(card, 4, null)).toEqual({
      activationHoleNumber: 4,
      holesRemaining: 6,
      tally: 0,
      banked: 0,
      status: 'in_progress',
    })
  })

  it('carries a declared count, bounded to a real hole range', () => {
    const card = effect({ conditionalKey: 'gir_bonus' }, 9)
    expect(buildWindowMetadata(card, 1, { numberValue: 99 }).declaredCount).toBe(18)
    expect(buildWindowMetadata(card, 1, { numberValue: -4 }).declaredCount).toBe(1)
    expect(buildWindowMetadata(card, 1, { numberValue: 'x' }).declaredCount).toBeUndefined()
  })

  it('prefers an explicit multi-select over a single target', () => {
    const card = effect({ conditionalKey: 'none' }, 3)
    const meta = buildWindowMetadata(card, 1, {
      selectedPlayerIds: ['a', 'b'],
      targetPlayerId: 'c',
    })
    expect(meta.targetPlayerIds).toEqual(['a', 'b'])
  })
})

describe('the new cards behave as their text claims', () => {
  it("Second Wind cancels a bogey but not a double", async () => {
    const card = effect({ conditionalKey: 'bogey_rescue', modifier: -1, bank: 'sum' }, 9)
    // bogey, double, par, bogey → only the two bogeys are rescued.
    const r = await run(card, holes([5, 4], [6, 4], [4, 4], [5, 4]), { finalize: true })
    expect(r.scoreModifier).toBe(-2)
  })

  it("Sandbagger's Bluff pays -3 only for an exact call", async () => {
    const card = effect({ conditionalKey: 'exact_call', modifier: -3, bank: 'sum' }, 1)
    scoreRows = holes([5, 4])

    const exact = await evaluateWindowedPowerup(
      'pp_1', 'slug', 'Bluff', card, 'tp_me', 'round_1',
      buildWindowMetadata(card, 1, { numberValue: 5 }),
    )
    expect(exact.scoreModifier).toBe(-3)
  })

  it("Sandbagger's Bluff pays nothing for a miss of one", async () => {
    const card = effect({ conditionalKey: 'exact_call', modifier: -3, bank: 'sum' }, 1)
    scoreRows = holes([5, 4])
    const off1 = await evaluateWindowedPowerup(
      'pp_1', 'slug', 'Bluff', card, 'tp_me', 'round_1',
      buildWindowMetadata(card, 1, { numberValue: 4 }),
    )
    expect(off1.scoreModifier).toBe(0)
  })

  it("Sandbagger's Bluff costs you for a miss of two or more", async () => {
    const card = effect({ conditionalKey: 'exact_call', modifier: -3, bank: 'sum' }, 1)
    scoreRows = holes([7, 4])
    const off3 = await evaluateWindowedPowerup(
      'pp_1', 'slug', 'Bluff', card, 'tp_me', 'round_1',
      buildWindowMetadata(card, 1, { numberValue: 4 }),
    )
    expect(off3.scoreModifier).toBe(2)
  })

  it('COVID Birdie never touches a score, it just counts down', async () => {
    const card = effect({ conditionalKey: 'none', modifier: 0, bank: 'none' }, 6)
    const r = await run(card, holes([3, 4], [9, 4]))
    expect(r.outcome).toBe('in_progress')
    expect(r.message).toContain('4 holes remaining')
    expect(updated).toMatchObject({ banked: 0, tally: 0 })
  })

  it('Tax Collector charges the victim for playing well', async () => {
    const card = effect(
      { conditionalKey: 'birdie_tax', modifier: 1, bank: 'sum' },
      6,
      { requiresTarget: true },
    )
    // 3 birdies in the window → +3 on the victim.
    const r = await run(card, holes([3, 4], [4, 4], [3, 4], [5, 4], [4, 5], [6, 4]), {
      targetPlayerIds: ['tp_victim'],
    })
    expect(r.scoreModifier).toBe(3)
  })
})

describe('HOLE_PREDICATES', () => {
  const facts = (strokes: number, par: number, extra?: Partial<{ putts: number; gir: boolean; fairwayHit: boolean }>) => ({
    holeNumber: 1,
    par,
    strokes,
    putts: extra?.putts ?? null,
    fairwayHit: extra?.fairwayHit ?? null,
    gir: extra?.gir ?? null,
  })
  const ctx = { previous: null, index: 0, unit: -1, declared: null }

  it('fairway_bonus skips par 3s instead of failing them', () => {
    expect(HOLE_PREDICATES.fairway_bonus(facts(3, 3, { fairwayHit: false }), ctx)).toEqual({})
    expect(HOLE_PREDICATES.fairway_bonus(facts(4, 4, { fairwayHit: true }), ctx)).toEqual({
      delta: -1,
      counted: true,
    })
  })

  it('no_three_putt treats missing putt data as not a three-putt', () => {
    expect(HOLE_PREDICATES.no_three_putt(facts(4, 4), ctx)).toEqual({ delta: -1, counted: true })
    expect(HOLE_PREDICATES.no_three_putt(facts(4, 4, { putts: 3 }), ctx)).toEqual({ fail: true })
  })

  it('over_par_drain scales with how far over par the hole was', () => {
    expect(HOLE_PREDICATES.over_par_drain(facts(7, 4), { ...ctx, unit: 1 })).toEqual({
      delta: 3,
      counted: true,
    })
    expect(HOLE_PREDICATES.over_par_drain(facts(3, 4), { ...ctx, unit: 1 })).toEqual({})
  })

  it('beat_previous_hole needs a previous hole to compare against', () => {
    expect(HOLE_PREDICATES.beat_previous_hole(facts(3, 4), ctx)).toEqual({})
    expect(
      HOLE_PREDICATES.beat_previous_hole(facts(3, 4), { ...ctx, previous: facts(5, 4) }),
    ).toEqual({ delta: -1, counted: true, extend: 1 })
  })

  it('none never contributes anything', () => {
    expect(HOLE_PREDICATES.none(facts(9, 3), ctx)).toEqual({})
  })
})
