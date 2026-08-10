import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Every admin-gated route under /api/tournaments/[id] must go through the
// shared isTournamentAdmin helper — it is the only check that honours
// account-level co-admins (AccountAdmin), which the admin UI already grants.
// These routes used to re-implement `membership?.isAdmin || role === 'ADMIN'`
// inline, so a co-admin could open the draft admin page and then get a 403
// from the API behind it.

const authMock = { getUser: vi.fn(), isTournamentAdmin: vi.fn() }

// Everything resolves empty, so a route that gets *past* the gate falls out on
// its own "not found" path rather than 403. We only care which side of the
// gate we landed on.
const emptyModel = {
  findUnique: vi.fn(async () => null),
  findFirst: vi.fn(async () => null),
  findMany: vi.fn(async () => []),
  update: vi.fn(async () => ({})),
  updateMany: vi.fn(async () => ({ count: 0 })),
  delete: vi.fn(async () => ({})),
  deleteMany: vi.fn(async () => ({ count: 0 })),
  create: vi.fn(async () => ({})),
  count: vi.fn(async () => 0),
}

const prismaMock: Record<string, unknown> = {
  $transaction: vi.fn(async (fn: unknown) =>
    typeof fn === 'function' ? (fn as (tx: unknown) => unknown)(prismaMock) : null,
  ),
}
for (const model of [
  'tournament', 'tournamentPlayer', 'draft', 'draftPick', 'playerPowerup',
  'tournamentMessage', 'notification', 'score', 'tournamentRound',
]) {
  prismaMock[model] = { ...emptyModel }
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  authMock.getUser.mockResolvedValue({ id: 'user_1', role: 'USER' })
})

type Case = {
  name: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  load: () => Promise<Record<string, unknown>>
  params: Record<string, string>
  body?: unknown
}

const cases: Case[] = [
  { name: 'draft/start', method: 'POST', load: () => import('./start/route'), params: { id: 'tourn_1' } },
  { name: 'draft/reset', method: 'POST', load: () => import('./reset/route'), params: { id: 'tourn_1' } },
  { name: 'draft/random', method: 'POST', load: () => import('./random/route'), params: { id: 'tourn_1' } },
  {
    name: 'draft/order', method: 'PUT', load: () => import('./order/route'),
    params: { id: 'tourn_1' }, body: { order: ['tp_1'] },
  },
  {
    name: 'draft/pick/[pickId]', method: 'PATCH', load: () => import('./pick/[pickId]/route'),
    params: { id: 'tourn_1', pickId: 'pick_1' }, body: { powerupId: 'pw_1' },
  },
  {
    name: 'tournaments/[id] PATCH', method: 'PATCH', load: () => import('../route'),
    params: { id: 'tourn_1' }, body: { name: 'Renamed' },
  },
  { name: 'tournaments/[id] DELETE', method: 'DELETE', load: () => import('../route'), params: { id: 'tourn_1' } },
]

function req(c: Case) {
  return new NextRequest('http://localhost/api/tournaments/tourn_1', {
    method: c.method,
    ...(c.body === undefined
      ? {}
      : { body: JSON.stringify(c.body), headers: { 'Content-Type': 'application/json' } }),
  })
}

async function call(c: Case) {
  const mod = await c.load()
  const handler = mod[c.method] as (r: NextRequest, ctx: unknown) => Promise<Response>
  return handler(req(c), { params: Promise.resolve(c.params) })
}

describe('tournament-admin gate on API routes', () => {
  for (const c of cases) {
    it(`${c.name} rejects a non-admin via isTournamentAdmin`, async () => {
      authMock.isTournamentAdmin.mockResolvedValue(false)

      const res = await call(c)

      expect(res.status).toBe(403)
      expect(authMock.isTournamentAdmin).toHaveBeenCalledWith('user_1', 'tourn_1')
    })

    it(`${c.name} lets an admin through the gate`, async () => {
      authMock.isTournamentAdmin.mockResolvedValue(true)

      const res = await call(c)

      // Past the gate the empty fixtures produce 4xx/5xx from the handler's own
      // logic — anything but 403 proves authorization is no longer the blocker.
      expect(res.status).not.toBe(403)
    })
  }

  it('draft/auto-pick stays participant-callable but requires membership', async () => {
    // Deliberately NOT admin-gated: any participant fires it when the turn
    // timer expires. A global ADMIN with no membership must still be refused.
    authMock.getUser.mockResolvedValue({ id: 'user_1', role: 'ADMIN' })
    const players = prismaMock.tournamentPlayer as typeof emptyModel
    players.findUnique.mockResolvedValue(null)

    const { POST } = await import('./auto-pick/route')
    const res = await POST(
      new NextRequest('http://localhost/api/tournaments/tourn_1/draft/auto-pick', { method: 'POST' }),
      { params: Promise.resolve({ id: 'tourn_1' }) },
    )

    expect(res.status).toBe(403)
    expect(authMock.isTournamentAdmin).not.toHaveBeenCalled()
  })
})
