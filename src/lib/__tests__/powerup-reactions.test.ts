/**
 * Reactive powerups — armed cards that fire on somebody else's action.
 *
 * Two layers under test:
 *
 * 1. REACTIONS, the pure registry: what each reaction does to the triggering
 *    attack and to itself, including the decided edge case where the attacker
 *    has already finished their round and there is nowhere for a bounced
 *    modifier to land.
 *
 * 2. fireReactions, the orchestration: which party's card answers which
 *    trigger, that a blocker is consumed exactly once under concurrent
 *    attacks, and that arming a card cannot set off a Tripwire (the recursion
 *    guard).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

interface ArmedRow {
  id: string
  tournamentPlayerId: string
  targetPlayerId: string | null
  holeNumber: number | null
  powerup: { name: string; effect: unknown }
  tournamentPlayer: { user: { name: string | null } }
}

let armedRows: ArmedRow[] = []
let attackerScoredHoles: number[] = []
/** Make the atomic claim fail, simulating another attack getting there first. */
let claimCount = 1

const consumeWrites: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = []

const prismaMock = {
  playerPowerup: {
    findMany: vi.fn(async () => armedRows),
    updateMany: vi.fn(async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      consumeWrites.push(args)
      return { count: claimCount }
    }),
  },
  score: {
    findMany: vi.fn(async () => attackerScoredHoles.map((n) => ({ hole: { number: n } }))),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const {
  REACTIONS,
  fireReactions,
  reactionFor,
  activationTriggersReactions,
  ABSORB_REWARD,
  TRIPWIRE_PENALTY,
} = await import('@/lib/powerup-reactions')
const { powerupEffectSchema } = await import('@/lib/powerup-engine')

/** A reactive effect, validated through the real schema. */
function reactiveEffect(reaction: 'deflect' | 'absorb' | 'tripwire', requiresTarget = false) {
  return powerupEffectSchema.parse({
    scoring: { mode: 'reactive', modifier: 0, conditionalKey: null, reaction },
    duration: 1,
    requiresTarget,
    input: null,
    restrictions: { excludePar3: false },
    flavorText: 't',
  })
}

const ALL_HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

const ctx = (overrides: Partial<Parameters<typeof REACTIONS.deflect.apply>[0]> = {}) => ({
  attackerName: 'Alice',
  holderName: 'Bob',
  incomingName: 'The Vampire',
  incomingModifier: 3,
  attackerLandingHole: 7,
  ...overrides,
})

const subjects = { attackerPlayerId: 'tp_alice', holderPlayerId: 'tp_bob' }

beforeEach(() => {
  vi.clearAllMocks()
  armedRows = []
  attackerScoredHoles = []
  claimCount = 1
  consumeWrites.length = 0
})

// ─── 1. The registry ─────────────────────────────────────────────────────────

describe('REACTIONS.deflect', () => {
  it('sends the attack back at its sender', () => {
    const out = REACTIONS.deflect.apply(ctx(), subjects)
    expect(out.incoming).toEqual({ targetPlayerId: 'tp_alice', targetHoleNumber: 7 })
    expect(out.self.scoreModifier).toBe(0)
    expect(out.message).toContain('DEFLECTED')
    expect(out.message).toContain('Hole 7')
  })

  it('does NOT zero the modifier — the attack still happens, to someone else', () => {
    const out = REACTIONS.deflect.apply(ctx(), subjects)
    expect(out.incoming?.scoreModifier).toBeUndefined()
  })

  it('cancels outright when the attacker has already finished', () => {
    // The decided edge case: bouncing it onto a closed scorecard would fight
    // the finished-card lock, so it fizzles instead.
    const out = REACTIONS.deflect.apply(ctx({ attackerLandingHole: null }), subjects)
    expect(out.incoming).toEqual({ scoreModifier: 0, targetPlayerId: null, targetHoleNumber: null })
    expect(out.message).toContain('fizzled')
  })

  it('answers the on_targeted trigger', () => {
    expect(REACTIONS.deflect.trigger).toBe('on_targeted')
  })
})

describe('REACTIONS.absorb', () => {
  it('cancels the attack and pays its holder', () => {
    const out = REACTIONS.absorb.apply(ctx(), subjects)
    expect(out.incoming).toEqual({ scoreModifier: 0, targetPlayerId: null, targetHoleNumber: null })
    expect(out.self.scoreModifier).toBe(ABSORB_REWARD)
    expect(ABSORB_REWARD).toBeLessThan(0)   // negative = helps the holder
  })

  it('does not care whether the attacker has finished', () => {
    const out = REACTIONS.absorb.apply(ctx({ attackerLandingHole: null }), subjects)
    expect(out.self.scoreModifier).toBe(ABSORB_REWARD)
  })
})

describe('REACTIONS.tripwire', () => {
  it('taxes the attacker on their own next hole and lets the attack through', () => {
    const out = REACTIONS.tripwire.apply(ctx(), subjects)
    // The attack itself is untouched — this is a tax on attacking, not a block.
    expect(out.incoming).toBeUndefined()
    expect(out.self).toEqual({
      scoreModifier: TRIPWIRE_PENALTY,
      targetPlayerId: 'tp_alice',
      targetHoleNumber: 7,
    })
    expect(TRIPWIRE_PENALTY).toBeGreaterThan(0)   // positive = hurts them
  })

  it('lapses when the attacker has finished, rather than rewriting a closed card', () => {
    const out = REACTIONS.tripwire.apply(ctx({ attackerLandingHole: null }), subjects)
    expect(out.self.scoreModifier).toBe(0)
    expect(out.message).toContain('lapsed')
  })

  it('answers the on_attacking trigger', () => {
    expect(REACTIONS.tripwire.trigger).toBe('on_attacking')
  })
})

describe('reactionFor', () => {
  it('resolves a reactive card to its reaction', () => {
    expect(reactionFor(reactiveEffect('deflect'))).toBe(REACTIONS.deflect)
  })

  it('returns null for a non-reactive card', () => {
    const windowed = powerupEffectSchema.parse({
      scoring: { mode: 'windowed', modifier: -1, conditionalKey: 'birdie_bonus', bank: 'sum' },
      duration: 3,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 't',
    })
    expect(reactionFor(windowed)).toBeNull()
  })
})

describe('activationTriggersReactions — the recursion guard', () => {
  const plainAttack = powerupEffectSchema.parse({
    scoring: { mode: 'manual', modifier: 1, conditionalKey: 'x' },
    duration: 1,
    requiresTarget: true,
    input: null,
    restrictions: { excludePar3: false },
    flavorText: 't',
  })

  it('a plain attack triggers reactions', () => {
    expect(activationTriggersReactions(plainAttack, 'ATTACK')).toBe(true)
  })

  it('arming a reactive card does NOT — a Tripwire cannot catch a Tripwire', () => {
    expect(activationTriggersReactions(reactiveEffect('tripwire', true), 'ATTACK')).toBe(false)
  })

  it('a boost triggers nothing', () => {
    expect(activationTriggersReactions(plainAttack, 'BOOST')).toBe(false)
  })
})

// ─── 2. The orchestration ────────────────────────────────────────────────────

const fire = (victim: string | null = 'tp_bob') =>
  fireReactions({
    tournamentId: 'tourn_1',
    roundId: 'round_1',
    attackerPlayerId: 'tp_alice',
    attackerName: 'Alice',
    victimPlayerId: victim,
    incomingName: 'The Vampire',
    incomingModifier: 3,
    courseHoleNumbers: ALL_HOLES,
  })

const deflectorHeldBy = (playerId: string, id = 'pp_def'): ArmedRow => ({
  id,
  tournamentPlayerId: playerId,
  targetPlayerId: null,
  holeNumber: 3,
  powerup: { name: 'Deflector', effect: reactiveEffect('deflect') },
  tournamentPlayer: { user: { name: 'Bob' } },
})

const tripwireOn = (rivalId: string, holderId = 'tp_carol', id = 'pp_trip'): ArmedRow => ({
  id,
  tournamentPlayerId: holderId,
  targetPlayerId: rivalId,
  holeNumber: 2,
  powerup: { name: 'Tripwire', effect: reactiveEffect('tripwire', true) },
  tournamentPlayer: { user: { name: 'Carol' } },
})

describe('fireReactions — whose card answers which trigger', () => {
  it('does nothing when nobody is armed', async () => {
    const r = await fire()
    expect(r).toEqual({ incoming: null, messages: [], consumed: [] })
    expect(prismaMock.score.findMany).not.toHaveBeenCalled()
  })

  it('fires the VICTIM\'s deflector, not a bystander\'s', async () => {
    // The bystander is deliberately FIRST. With the victim's card first, the
    // "one blocker per attack" break would end the loop before the bystander
    // was ever considered — so the test would pass even with the ownership
    // guard removed, which it did until this ordering was fixed.
    armedRows = [deflectorHeldBy('tp_zoe', 'pp_bystander'), deflectorHeldBy('tp_bob', 'pp_victim')]

    const r = await fire('tp_bob')

    expect(r.consumed).toEqual([{ playerPowerupId: 'pp_victim', reaction: 'on_targeted' }])
    expect(r.incoming).toMatchObject({ targetPlayerId: 'tp_alice' })
  })

  it('fires a tripwire wired onto the ATTACKER, not one wired onto anyone else', async () => {
    // Irrelevant one first, for the same reason as above.
    armedRows = [tripwireOn('tp_zoe', 'tp_carol', 'pp_on_zoe'), tripwireOn('tp_alice', 'tp_carol', 'pp_on_alice')]

    const r = await fire(null)

    expect(r.consumed).toEqual([{ playerPowerupId: 'pp_on_alice', reaction: 'on_attacking' }])
  })

  it('consumes only ONE blocker even when the victim holds two', async () => {
    armedRows = [deflectorHeldBy('tp_bob', 'pp_a'), deflectorHeldBy('tp_bob', 'pp_b')]

    const r = await fire('tp_bob')

    expect(r.consumed).toHaveLength(1)
  })

  it('stacks every tripwire — two rivals may both have wired you', async () => {
    armedRows = [
      tripwireOn('tp_alice', 'tp_carol', 'pp_t1'),
      tripwireOn('tp_alice', 'tp_dave', 'pp_t2'),
    ]

    const r = await fire(null)

    expect(r.consumed.map((c) => c.playerPowerupId).sort()).toEqual(['pp_t1', 'pp_t2'])
  })

  it('resolves a tripwire BEFORE a deflector, so attacking is taxed either way', async () => {
    armedRows = [deflectorHeldBy('tp_bob', 'pp_def'), tripwireOn('tp_alice', 'tp_carol', 'pp_trip')]

    const r = await fire('tp_bob')

    expect(r.consumed.map((c) => c.playerPowerupId)).toEqual(['pp_trip', 'pp_def'])
    expect(r.messages).toHaveLength(2)
  })
})

describe('fireReactions — the atomic claim', () => {
  it('claims with the ARMED status in the predicate', async () => {
    armedRows = [deflectorHeldBy('tp_bob')]
    await fire('tp_bob')

    expect(consumeWrites[0].where).toMatchObject({ id: 'pp_def', status: 'ARMED' })
    expect(consumeWrites[0].data).toMatchObject({ status: 'USED' })
  })

  it('treats a lost race as not firing at all', async () => {
    // Another attack got the same Deflector first: the UPDATE matches nothing,
    // so this attack must proceed unblocked rather than being told it was
    // deflected by a card somebody else already spent.
    armedRows = [deflectorHeldBy('tp_bob')]
    claimCount = 0

    const r = await fire('tp_bob')

    expect(r.consumed).toHaveLength(0)
    expect(r.messages).toHaveLength(0)
    expect(r.incoming).toBeNull()
  })
})

describe('fireReactions — landing hole', () => {
  it('bounces onto the attacker\'s next unscored hole', async () => {
    armedRows = [deflectorHeldBy('tp_bob')]
    attackerScoredHoles = [1, 2, 3]

    const r = await fire('tp_bob')

    // computeAttackTargetHole prefers the SECOND unscored hole so nobody is
    // hit on the hole they are stood on: 4 is next, so it lands on 5.
    expect(r.incoming?.targetHoleNumber).toBe(5)
  })

  it('cancels when the attacker has scored every hole', async () => {
    armedRows = [deflectorHeldBy('tp_bob')]
    attackerScoredHoles = ALL_HOLES

    const r = await fire('tp_bob')

    expect(r.incoming).toMatchObject({ scoreModifier: 0, targetPlayerId: null })
    expect(r.messages[0]).toContain('fizzled')
  })
})

describe('fireReactions — bad data', () => {
  it('skips a card whose effect is malformed rather than failing the activation', async () => {
    armedRows = [
      { ...deflectorHeldBy('tp_bob', 'pp_bad'), powerup: { name: 'Broken', effect: { nope: true } } },
      deflectorHeldBy('tp_bob', 'pp_good'),
    ]

    const r = await fire('tp_bob')

    expect(r.consumed).toEqual([{ playerPowerupId: 'pp_good', reaction: 'on_targeted' }])
  })

  it('skips a card naming a reaction that does not exist', async () => {
    armedRows = [
      {
        ...deflectorHeldBy('tp_bob', 'pp_unknown'),
        powerup: {
          name: 'Ghost',
          effect: { ...reactiveEffect('deflect'), scoring: { mode: 'reactive', modifier: 0, conditionalKey: null, reaction: 'nope' } },
        },
      },
    ]

    const r = await fire('tp_bob')

    expect(r.consumed).toHaveLength(0)
  })
})
