import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Cross-tournament IDOR regression. The route scopes the *caller* to the
// tournament in the URL; these tests pin that roundId, targetPlayerId and
// metadata.selectedPlayerIds are scoped too. A revert to `findUnique` on
// either lookup fails here, because the mocks only answer `findFirst`.

const authMock = { getUser: vi.fn() }
const pushMock = { sendPushToUser: vi.fn(async () => {}) }
const broadcastMock = { broadcastNotification: vi.fn(async () => {}) }

const ATTACK_EFFECT = {
  scoring: { mode: 'auto', modifier: 1, conditionalKey: null },
  duration: 1,
  requiresTarget: true,
  input: null,
  restrictions: { excludePar3: false },
  flavorText: '',
}

const BOOST_EFFECT = { ...ATTACK_EFFECT, requiresTarget: false }

// Can I Get Your Number — the number in metadata becomes the player's stroke
// count for the hole, so it is a score, not a modifier.
const NUMBER_EFFECT = {
  ...BOOST_EFFECT,
  scoring: { mode: 'manual', modifier: null, conditionalKey: 'random_number' },
  input: { type: 'number_input', label: 'What number did they pick? (1-10)', count: null },
}

const HOLES = [
  { id: 'h1', number: 1, par: 4 },
  { id: 'h2', number: 2, par: 4 },
]

// Set per test. `null` models "exists, but not in this tournament" — which is
// exactly what the added tournamentId predicate turns into a miss.
let roundRow: unknown = null
let targetPlayerRow: unknown = null
let selectedInTournament = 0
const claimWrites: Array<Record<string, unknown>> = []

const prismaMock = {
  tournamentPlayer: {
    findUnique: vi.fn(async () => ({ id: 'tp_caller', user: { name: 'Caller' } })),
    findFirst: vi.fn(async () => targetPlayerRow),
    count: vi.fn(async () => selectedInTournament),
  },
  playerPowerup: {
    findUnique: vi.fn(async () => ({
      id: 'pp_1',
      tournamentPlayerId: 'tp_caller',
      status: 'AVAILABLE',
      powerup: {
        id: 'p_1',
        slug: currentSlug,
        name: 'Out of Bounds',
        type: currentPowerupType,
        description: 'd',
        effect: currentEffect,
      },
    })),
    updateMany: vi.fn(async (args: { data: Record<string, unknown> }) => {
      claimWrites.push(args.data)
      return { count: 1 }
    }),
  },
  tournamentRound: { findFirst: vi.fn(async () => roundRow) },
  score: { findMany: vi.fn(async () => []) },
  notification: { create: vi.fn(async () => ({ id: 'n_1' })) },
  tournamentMessage: { create: vi.fn(async () => ({ id: 'm_1' })) },
}

let currentPowerupType = 'ATTACK'
let currentEffect: unknown = ATTACK_EFFECT
let currentSlug = 'out-of-bounds'

// `after()` throws outside a request scope, so run the callback inline. That
// also lets the push/broadcast assertions below see it.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (fn: () => unknown) => { void fn() },
}))

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/push', () => pushMock)
vi.mock('@/lib/notification-broadcast', () => broadcastMock)

beforeEach(() => {
  vi.clearAllMocks()
  authMock.getUser.mockResolvedValue({ id: 'user_caller' })
  currentPowerupType = 'ATTACK'
  currentEffect = ATTACK_EFFECT
  currentSlug = 'out-of-bounds'
  roundRow = { id: 'round_1', course: { holes: HOLES } }
  targetPlayerRow = {
    id: 'tp_target',
    user: { id: 'user_target', name: 'Target' },
    tournament: { slug: 'the-open', name: 'The Open' },
  }
  selectedInTournament = 0
  claimWrites.length = 0
})

const ctx = () => ({ params: Promise.resolve({ id: 'tourn_1' }) })

function req(body: unknown) {
  return new NextRequest('http://localhost/api/tournaments/tourn_1/powerups/activate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const attackBody = {
  playerPowerupId: 'pp_1',
  roundId: 'round_1',
  holeNumber: 1,
  targetPlayerId: 'tp_target',
}

describe('POST /api/tournaments/[id]/powerups/activate — cross-tournament scoping', () => {
  it('rejects a roundId belonging to another tournament', async () => {
    roundRow = null

    const { POST } = await import('./route')
    const res = await POST(req(attackBody), ctx())

    expect(res.status).toBe(404)
    expect(prismaMock.tournamentRound.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'round_1', tournamentId: 'tourn_1' } }),
    )
    expect(prismaMock.playerPowerup.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })

  it('rejects a targetPlayerId belonging to another tournament', async () => {
    targetPlayerRow = null

    const { POST } = await import('./route')
    const res = await POST(req(attackBody), ctx())

    expect(res.status).toBe(403)
    expect(prismaMock.tournamentPlayer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tp_target', tournamentId: 'tourn_1' },
      }),
    )
    // The row must not be written before the target is validated — the bug was
    // an ordering one, not just a missing check.
    expect(prismaMock.playerPowerup.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
    expect(pushMock.sendPushToUser).not.toHaveBeenCalled()
  })

  it('rejects metadata.selectedPlayerIds containing a foreign player', async () => {
    currentPowerupType = 'BOOST'
    currentEffect = BOOST_EFFECT
    selectedInTournament = 1 // only one of the two ids is in this tournament

    const { POST } = await import('./route')
    const res = await POST(
      req({
        playerPowerupId: 'pp_1',
        roundId: 'round_1',
        holeNumber: 1,
        metadata: { selectedPlayerIds: ['tp_a', 'tp_foreign'] },
      }),
      ctx(),
    )

    expect(res.status).toBe(403)
    expect(prismaMock.tournamentPlayer.count).toHaveBeenCalledWith({
      where: { id: { in: ['tp_a', 'tp_foreign'] }, tournamentId: 'tourn_1' },
    })
    expect(prismaMock.playerPowerup.updateMany).not.toHaveBeenCalled()
  })

  it('allows an attack when round and target are both in this tournament', async () => {
    const { POST } = await import('./route')
    const res = await POST(req(attackBody), ctx())

    expect(res.status).toBe(200)
    expect(prismaMock.playerPowerup.updateMany).toHaveBeenCalledTimes(1)

    const data = claimWrites[0]
    expect(data.targetPlayerId).toBe('tp_target')
    // Target has no scores, so the attack lands on the hole *after* the one
    // they're on (computeAttackTargetHole: unscored[1] ?? unscored[0]).
    expect(data.targetHoleNumber).toBe(2)
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
  })
})

// Can I Get Your Number writes metadata.numberValue straight through to the
// row, and the stroke-override engine later uses it *as* the player's score
// for the hole. Nothing between those two points bounds it, so the route has
// to. Range is the scores API's legal hole score: an integer 1–20.
describe('POST /api/tournaments/[id]/powerups/activate — stroke-override number', () => {
  const numberBody = (numberValue: unknown) => ({
    playerPowerupId: 'pp_1',
    roundId: 'round_1',
    holeNumber: 1,
    metadata: { numberValue },
  })

  beforeEach(() => {
    currentPowerupType = 'BOOST'
    currentEffect = NUMBER_EFFECT
    currentSlug = 'can-i-get-your-number'
  })

  it.each([[-500], [0], [21], [3.5], ['4'], [undefined]])(
    'rejects numberValue %p without writing the row',
    async (numberValue) => {
      const { POST } = await import('./route')
      const res = await POST(req(numberBody(numberValue)), ctx())

      expect(res.status).toBe(400)
      expect(prismaMock.playerPowerup.updateMany).not.toHaveBeenCalled()
    },
  )

  it('accepts a legal hole score and stores it untouched', async () => {
    const { POST } = await import('./route')
    const res = await POST(req(numberBody(7)), ctx())

    expect(res.status).toBe(200)
    expect((claimWrites[0].metadata as { numberValue: number }).numberValue).toBe(7)
  })
})
