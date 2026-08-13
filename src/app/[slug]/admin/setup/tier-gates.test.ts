import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// Regression tests for the U06 tier bypass.
// updateTournament writes the same paid-feature columns the creation wizard
// gates, but only checked isTournamentAdmin — which the free-tier creator
// always satisfies. Every gate below blocks the *transition* that grants an
// unentitled feature; turning a feature off or clearing it must keep working.

const authMock = {
  requireAuth: vi.fn(),
  isTournamentAdmin: vi.fn(),
}

const txMock = {
  tournament: {
    update: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 't1', ...args.data })),
  },
  tournamentPowerup: { count: vi.fn(async () => 1), createMany: vi.fn() },
  powerup: { findMany: vi.fn(async () => []) },
  draft: { findUnique: vi.fn(async () => ({ id: 'd1' })), create: vi.fn() },
}

const prismaMock = {
  tournament: { findUnique: vi.fn(), update: vi.fn() },
  score: { count: vi.fn(async () => 0) },
  draft: { findUnique: vi.fn(async () => null) },
  playerPowerup: { count: vi.fn(async () => 0) },
  tournamentRound: { findMany: vi.fn(async () => []), updateMany: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
}

const stripeMock = { getTournamentTier: vi.fn(async () => 'FREE') }

const uploadMock = vi.fn(async () => ({ error: null }))
const supabaseMock = {
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    },
  }),
}

vi.mock('@/lib/auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/stripe', () => stripeMock)
vi.mock('@/lib/supabase', () => supabaseMock)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

type Row = Record<string, unknown>

function tournamentRow(overrides: Row = {}): Row {
  return {
    id: 't1',
    slug: 'ryder',
    tournamentType: 'OPEN',
    tournamentFormat: 'STROKE_PLAY',
    handicapSystem: 'NONE',
    status: 'REGISTRATION',
    primaryColor: '#006747',
    accentColor: '#C9A84C',
    logo: null,
    headerImage: null,
    powerupsEnabled: false,
    powerupsPerPlayer: 3,
    maxAttacksPerPlayer: 1,
    distributionMode: 'DRAFT',
    isOpenRegistration: true,
    isLeague: false,
    parentTournamentId: null,
    startDate: null,
    endDate: null,
    leagueEndDate: null,
    ...overrides,
  }
}

function makeFormData(over: Record<string, string | File> = {}): FormData {
  const fd = new FormData()
  fd.set('name', 'Ryder Cup')
  fd.set('slug', 'ryder')
  fd.set('primaryColor', '#006747')
  fd.set('accentColor', '#C9A84C')
  fd.set('powerupsPerPlayer', '3')
  fd.set('maxAttacksPerPlayer', '1')
  fd.set('distributionMode', 'DRAFT')
  for (const [k, v] of Object.entries(over)) fd.set(k, v)
  return fd
}

let updateTournament: typeof import('./actions').updateTournament

// Warm the module graph in the hook (10s budget) instead of paying the cold
// import inside the first test (5s) — that timeout is a known flake here.
beforeAll(async () => {
  await import('@/lib/supabase')
  ;({ updateTournament } = await import('./actions'))
})

function save(
  fd: FormData,
  images: { logo?: string | null; headerImage?: string | null } = {},
) {
  return updateTournament('t1', 'ryder', images.logo ?? null, images.headerImage ?? null, null, fd)
}

const savedData = () => txMock.tournament.update.mock.calls[0][0].data

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireAuth.mockResolvedValue({ id: 'user_1' })
  authMock.isTournamentAdmin.mockResolvedValue(true)
  stripeMock.getTournamentTier.mockResolvedValue('FREE')
  prismaMock.tournament.findUnique.mockResolvedValue(tournamentRow())
})

describe('updateTournament — powerups tier gate', () => {
  it('refuses the off->on flip on FREE', async () => {
    const result = await save(makeFormData({ powerupsEnabled: 'on' }))
    expect(result).toEqual({ error: expect.stringMatching(/powerups require a paid plan/i) })
    expect(txMock.tournament.update).not.toHaveBeenCalled()
  })

  it('still lets an unentitled admin turn powerups OFF', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentRow({ powerupsEnabled: true }))
    const result = await save(makeFormData())
    expect(result).toEqual({ ok: true })
    expect(savedData().powerupsEnabled).toBe(false)
  })

  it('leaves powerups alone when they are already on and stay on', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentRow({ powerupsEnabled: true }))
    const result = await save(makeFormData({ powerupsEnabled: 'on' }))
    expect(result).toEqual({ ok: true })
    expect(savedData().powerupsEnabled).toBe(true)
  })

  it('allows the off->on flip on a paid tier', async () => {
    stripeMock.getTournamentTier.mockResolvedValue('PRO')
    const result = await save(makeFormData({ powerupsEnabled: 'on' }))
    expect(result).toEqual({ ok: true })
    expect(savedData().powerupsEnabled).toBe(true)
  })
})

describe('updateTournament — handicap tier gate', () => {
  it('does not adopt a format-implied handicap on FREE', async () => {
    const result = await save(makeFormData({ tournamentFormat: 'STROKE_PLAY_NET' }))
    expect(result).toEqual({ ok: true })
    expect(savedData().handicapSystem).toBe('NONE')
  })

  it('still writes an implied NONE through on FREE so a leftover handicap clears', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(
      tournamentRow({ handicapSystem: 'WHS', tournamentFormat: 'STROKE_PLAY_NET' }),
    )
    const result = await save(makeFormData({ tournamentFormat: 'STROKE_PLAY' }))
    expect(result).toEqual({ ok: true })
    expect(savedData().handicapSystem).toBe('NONE')
  })

  it('adopts the implied handicap on a paid tier', async () => {
    stripeMock.getTournamentTier.mockResolvedValue('PRO')
    const result = await save(makeFormData({ tournamentFormat: 'STROKE_PLAY_NET' }))
    expect(result).toEqual({ ok: true })
    expect(savedData().handicapSystem).toBe('WHS')
  })
})

describe('updateTournament — color tier gate', () => {
  it('refuses a changed primaryColor on FREE', async () => {
    const result = await save(makeFormData({ primaryColor: '#ff0000' }))
    expect(result).toEqual({ error: expect.stringMatching(/custom branding requires a paid plan/i) })
    expect(txMock.tournament.update).not.toHaveBeenCalled()
  })

  it('refuses a changed accentColor on FREE', async () => {
    const result = await save(makeFormData({ accentColor: '#ff0000' }))
    expect(result).toEqual({ error: expect.stringMatching(/custom branding requires a paid plan/i) })
    expect(txMock.tournament.update).not.toHaveBeenCalled()
  })

  it('lets an unentitled admin keep colors set while they were entitled', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(
      tournamentRow({ primaryColor: '#123456', accentColor: '#abcdef' }),
    )
    const result = await save(makeFormData({ primaryColor: '#123456', accentColor: '#ABCDEF' }))
    expect(result).toEqual({ ok: true })
    expect(savedData().primaryColor).toBe('#123456')
  })

  it('lets an unentitled admin reset back to the free defaults', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(
      tournamentRow({ primaryColor: '#123456', accentColor: '#abcdef' }),
    )
    const result = await save(makeFormData())
    expect(result).toEqual({ ok: true })
    expect(savedData()).toMatchObject({ primaryColor: '#006747', accentColor: '#C9A84C' })
  })

  it('allows a color change on a paid tier', async () => {
    stripeMock.getTournamentTier.mockResolvedValue('CLUB')
    const result = await save(makeFormData({ primaryColor: '#ff0000' }))
    expect(result).toEqual({ ok: true })
    expect(savedData().primaryColor).toBe('#ff0000')
  })
})

describe('updateTournament — logo and header image tier gate', () => {
  const png = () => new File([new Uint8Array([1, 2, 3])], 'brand.png', { type: 'image/png' })

  it('refuses a logo upload on FREE and never touches storage', async () => {
    const result = await save(makeFormData({ logo: png() }))
    expect(result).toEqual({ error: expect.stringMatching(/custom branding requires a paid plan/i) })
    expect(uploadMock).not.toHaveBeenCalled()
    expect(txMock.tournament.update).not.toHaveBeenCalled()
  })

  it('refuses a header image upload on FREE and never touches storage', async () => {
    const result = await save(makeFormData({ headerImage: png() }))
    expect(result).toEqual({ error: expect.stringMatching(/custom branding requires a paid plan/i) })
    expect(uploadMock).not.toHaveBeenCalled()
    expect(txMock.tournament.update).not.toHaveBeenCalled()
  })

  it('keeps an existing logo and banner saving on FREE when no new file is submitted', async () => {
    const result = await save(makeFormData(), {
      logo: 'https://cdn.test/old-logo.png',
      headerImage: 'https://cdn.test/old-banner.png',
    })
    expect(result).toEqual({ ok: true })
    expect(savedData()).toMatchObject({
      logo: 'https://cdn.test/old-logo.png',
      headerImage: 'https://cdn.test/old-banner.png',
    })
  })

  it('still lets an unentitled admin clear a logo back to null', async () => {
    const result = await save(makeFormData(), { logo: null })
    expect(result).toEqual({ ok: true })
    expect(savedData().logo).toBeNull()
  })

  it('allows logo and header uploads on a paid tier', async () => {
    stripeMock.getTournamentTier.mockResolvedValue('PRO')
    const result = await save(makeFormData({ logo: png(), headerImage: png() }))
    expect(result).toEqual({ ok: true })
    expect(uploadMock).toHaveBeenCalledTimes(2)
    expect(savedData().logo).toMatch(/^https:\/\/cdn\.test\/t1-/)
    expect(savedData().headerImage).toMatch(/^https:\/\/cdn\.test\/t1-/)
  })
})
