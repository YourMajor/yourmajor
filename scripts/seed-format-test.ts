/**
 * Seeds a complete test tournament for a given format. Creates the
 * tournament + a round on an existing course + 4-8 fake players + teams
 * (where the format requires them) + a partial set of scores so the
 * leaderboard has something to render.
 *
 * Usage:
 *   npx tsx scripts/seed-format-test.ts NASSAU
 *   npx tsx scripts/seed-format-test.ts SCRAMBLE
 *   npx tsx scripts/seed-format-test.ts                # seeds ALL formats
 *
 * Idempotent: re-running with the same format reuses the same slug
 * (`qa-{format-lower-kebab}`) and upserts everything inside.
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { selectPeoriaHoles } from '../src/lib/peoria'

type FormatId =
  | 'STROKE_PLAY' | 'STROKE_PLAY_NET' | 'STABLEFORD' | 'MODIFIED_STABLEFORD'
  | 'BEST_BALL_2' | 'BEST_BALL_4'
  | 'SCRAMBLE' | 'SHAMBLE' | 'CHAPMAN' | 'PINEHURST'
  | 'MATCH_PLAY' | 'RYDER_CUP' | 'NASSAU'
  | 'SKINS_GROSS' | 'SKINS_NET'
  | 'QUOTA' | 'CALLAWAY' | 'PEORIA' | 'LOW_GROSS_LOW_NET'

const ALL_FORMATS: FormatId[] = [
  'STROKE_PLAY', 'STROKE_PLAY_NET', 'STABLEFORD', 'MODIFIED_STABLEFORD',
  'BEST_BALL_2', 'BEST_BALL_4',
  'SCRAMBLE', 'SHAMBLE', 'CHAPMAN', 'PINEHURST',
  'MATCH_PLAY', 'RYDER_CUP', 'NASSAU',
  'SKINS_GROSS', 'SKINS_NET',
  'QUOTA', 'CALLAWAY', 'PEORIA', 'LOW_GROSS_LOW_NET',
]

// Per-format implied handicap (must match registry.ts).
const IMPLIED_HANDICAP: Record<FormatId, 'NONE' | 'WHS' | 'STABLEFORD' | 'CALLAWAY' | 'PEORIA'> = {
  STROKE_PLAY: 'NONE',
  STROKE_PLAY_NET: 'WHS',
  STABLEFORD: 'STABLEFORD',
  MODIFIED_STABLEFORD: 'STABLEFORD',
  BEST_BALL_2: 'WHS',
  BEST_BALL_4: 'WHS',
  SCRAMBLE: 'NONE',
  SHAMBLE: 'NONE',
  CHAPMAN: 'NONE',
  PINEHURST: 'NONE',
  MATCH_PLAY: 'NONE',
  RYDER_CUP: 'NONE',
  NASSAU: 'NONE',
  SKINS_GROSS: 'NONE',
  SKINS_NET: 'WHS',
  QUOTA: 'WHS',
  CALLAWAY: 'CALLAWAY',
  PEORIA: 'PEORIA',
  LOW_GROSS_LOW_NET: 'WHS',
}

const SINGLE_TEAM_SCORE: FormatId[] = ['SCRAMBLE', 'SHAMBLE', 'CHAPMAN', 'PINEHURST']
const BEST_BALL: FormatId[] = ['BEST_BALL_2', 'BEST_BALL_4']
const TEAM_FORMATS = [...SINGLE_TEAM_SCORE, ...BEST_BALL] as FormatId[]

interface FakePlayer {
  email: string
  name: string
  handicap: number
  /** Per-hole offsets vs par for an 18-hole round. */
  offsets: number[]
}

const FAKE_PLAYERS: FakePlayer[] = [
  { email: 'qa-alice@test.local',  name: 'Alice Albatross',  handicap: 4,  offsets: [0,0,-1, 0,0,1, 0,0,0,  0,1,0, -1,0,0, 1,0,0] },   // 73
  { email: 'qa-bob@test.local',    name: 'Bob Bogey',         handicap: 12, offsets: [1,0,1, 0,1,0, 1,0,0,  1,0,1, 0,1,0, 1,0,1] },     // 80
  { email: 'qa-carol@test.local',  name: 'Carol Clutch',      handicap: 8,  offsets: [0,1,0, 0,1,0, 0,0,1,  0,1,0, 0,1,0, 0,0,1] },     // 78
  { email: 'qa-dave@test.local',   name: 'Dave Duff',         handicap: 18, offsets: [1,1,1, 1,1,0, 1,1,1,  1,1,1, 0,1,1, 1,1,1] },     // 88
  { email: 'qa-erin@test.local',   name: 'Erin Eagle',        handicap: 0,  offsets: [-1,0,-1, 0,0,0, -1,0,0, 0,0,-1, 0,0,0, -1,0,0] }, // 67
  { email: 'qa-finn@test.local',   name: 'Finn Fairway',      handicap: 6,  offsets: [0,0,1, 1,0,0, 0,1,0,  0,0,1, 1,0,0, 0,1,0] },     // 77
]

function slugFor(format: FormatId): string {
  return `qa-${format.toLowerCase().replace(/_/g, '-')}`
}

async function ensureUser(p: FakePlayer): Promise<string> {
  const u = await prisma.user.upsert({
    where: { email: p.email },
    update: { name: p.name },
    create: { email: p.email, name: p.name },
  })
  return u.id
}

async function pickCourse(): Promise<{ id: string; par: number; holes: Array<{ id: string; number: number; par: number }> }> {
  const course = await prisma.course.findFirst({
    where: { holes: { some: {} } },
    include: { holes: { orderBy: { number: 'asc' } } },
  })
  if (!course || course.holes.length < 18) {
    throw new Error('No course with 18 holes found. Create one via the Course UI first, or import via the existing course-import flow.')
  }
  return {
    id: course.id,
    par: course.par,
    holes: course.holes.map((h) => ({ id: h.id, number: h.number, par: h.par })),
  }
}

async function ensureAdminUser(): Promise<string> {
  // Reuse the first PLAYER/ADMIN role'd user (likely the developer running the script)
  // as the tournament owner. This avoids creating a fake admin account.
  const u = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!u) throw new Error('No users in DB — sign in once via /auth/login first.')
  return u.id
}

interface SeedOverrides {
  /** Custom slug suffix; if provided, slug becomes `qa-{suffix}` instead of the format-derived default. */
  slugSuffix?: string
  /** How many of the 18 holes to seed scores for. Defaults to 12 (mid-round). */
  holesToScore?: number
}

async function seedFormat(
  format: FormatId,
  overrides: SeedOverrides = {},
): Promise<{ slug: string; status: string }> {
  const slug = overrides.slugSuffix ? `qa-${overrides.slugSuffix}` : slugFor(format)
  const ownerId = await ensureAdminUser()
  const course = await pickCourse()
  const teamSize = format === 'BEST_BALL_4' || format === 'RYDER_CUP' ? 4 : 2
  const teamsEnabled = TEAM_FORMATS.includes(format)
  const handicapSystem = IMPLIED_HANDICAP[format]

  // ── Tournament + round ────────────────────────────────────────────────────
  const tournament = await prisma.tournament.upsert({
    where: { slug },
    update: {
      tournamentFormat: format,
      handicapSystem,
      teamsEnabled,
      teamSize: teamsEnabled ? teamSize : null,
      status: 'ACTIVE',
    },
    create: {
      slug,
      name: `QA · ${format}`,
      description: `Auto-seeded test fixture for ${format}. Wipe with Tournament settings.`,
      tournamentFormat: format,
      handicapSystem,
      teamsEnabled,
      teamSize: teamsEnabled ? teamSize : null,
      status: 'ACTIVE',
      tournamentType: 'OPEN',
      isOpenRegistration: true,
    },
  })

  // Mark the owner as a tournament admin so the admin sidebar resolves.
  await prisma.tournamentPlayer.upsert({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId: ownerId } },
    update: { isAdmin: true },
    create: {
      tournamentId: tournament.id,
      userId: ownerId,
      isAdmin: true,
      isParticipant: false,
    },
  })

  // For Peoria, draw the 6 secret holes once at seed time so the fixture has a
  // stable revealed value when the round is fully scored. Idempotent — re-runs
  // preserve the existing pick rather than reshuffling.
  const existingRound = await prisma.tournamentRound.findUnique({
    where: { tournamentId_roundNumber: { tournamentId: tournament.id, roundNumber: 1 } },
    select: { peoriaHoles: true },
  })
  const peoriaHoles =
    format === 'PEORIA'
      ? (existingRound?.peoriaHoles.length
          ? existingRound.peoriaHoles
          : selectPeoriaHoles(course.holes.map((h) => ({ number: h.number, par: h.par }))))
      : []
  await prisma.tournamentRound.upsert({
    where: { tournamentId_roundNumber: { tournamentId: tournament.id, roundNumber: 1 } },
    update: { courseId: course.id, peoriaHoles },
    create: {
      tournamentId: tournament.id,
      roundNumber: 1,
      courseId: course.id,
      teeMode: 'UNIFORM',
      peoriaHoles,
    },
  })
  const round = await prisma.tournamentRound.findFirstOrThrow({
    where: { tournamentId: tournament.id, roundNumber: 1 },
  })

  // ── Players ───────────────────────────────────────────────────────────────
  const players = TEAM_FORMATS.includes(format) ? FAKE_PLAYERS.slice(0, 4) : FAKE_PLAYERS.slice(0, 4)
  const playerRows: Array<{ id: string; name: string; offsets: number[]; handicap: number }> = []

  for (const fp of players) {
    const userId = await ensureUser(fp)
    const tp = await prisma.tournamentPlayer.upsert({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
      update: { handicap: fp.handicap, isParticipant: true },
      create: {
        tournamentId: tournament.id,
        userId,
        handicap: fp.handicap,
        isAdmin: false,
        isParticipant: true,
      },
    })
    playerRows.push({ id: tp.id, name: fp.name, offsets: fp.offsets, handicap: fp.handicap })
  }

  // ── Teams (only for team formats) ─────────────────────────────────────────
  if (TEAM_FORMATS.includes(format) && playerRows.length >= 2) {
    // Wipe and rebuild teams to keep idempotent.
    await prisma.tournamentTeam.deleteMany({ where: { tournamentId: tournament.id } })
    const teamA = await prisma.tournamentTeam.create({
      data: { tournamentId: tournament.id, name: 'Team Albatross', color: '#10b981' },
    })
    const teamB = await prisma.tournamentTeam.create({
      data: { tournamentId: tournament.id, name: 'Team Birdie', color: '#3b82f6' },
    })
    const half = Math.floor(playerRows.length / 2)
    const teamAPlayers = playerRows.slice(0, half)
    const teamBPlayers = playerRows.slice(half)
    for (let i = 0; i < teamAPlayers.length; i++) {
      await prisma.tournamentTeamMember.create({
        data: {
          teamId: teamA.id,
          tournamentPlayerId: teamAPlayers[i].id,
          isCaptain: i === 0,
        },
      })
    }
    for (let i = 0; i < teamBPlayers.length; i++) {
      await prisma.tournamentTeamMember.create({
        data: {
          teamId: teamB.id,
          tournamentPlayerId: teamBPlayers[i].id,
          isCaptain: i === 0,
        },
      })
    }
  }

  // ── Scores: by default 12 holes (mid-round) so the leaderboard is "live".
  // Override via `overrides.holesToScore` (e.g. 18 for a fully-completed round
  // — used by the qa-peoria-complete fixture to verify the reveal gate flips).
  // For single-team-score formats, only the team-anchor (lex-smallest player id
  // on each team) gets scores so the strategy sees one row per team-hole.
  const HOLES_TO_SCORE = overrides.holesToScore ?? 12
  const teamAnchors: Set<string> = new Set()
  if (SINGLE_TEAM_SCORE.includes(format)) {
    const teams = await prisma.tournamentTeam.findMany({
      where: { tournamentId: tournament.id },
      include: { members: { select: { tournamentPlayerId: true } } },
    })
    for (const t of teams) {
      const anchor = [...t.members.map((m) => m.tournamentPlayerId)].sort()[0]
      if (anchor) teamAnchors.add(anchor)
    }
  }

  for (const pr of playerRows) {
    const isAnchor = SINGLE_TEAM_SCORE.includes(format) ? teamAnchors.has(pr.id) : true
    if (!isAnchor) continue
    for (let i = 0; i < HOLES_TO_SCORE; i++) {
      const hole = course.holes[i]
      const strokes = hole.par + (pr.offsets[i] ?? 0)
      await prisma.score.upsert({
        where: {
          tournamentPlayerId_holeId_roundId: {
            tournamentPlayerId: pr.id,
            holeId: hole.id,
            roundId: round.id,
          },
        },
        update: { strokes },
        create: {
          tournamentPlayerId: pr.id,
          holeId: hole.id,
          roundId: round.id,
          strokes,
        },
      })
    }
  }

  return { slug, status: tournament.status }
}

async function main() {
  const targetArg = process.argv[2]
  const targets: FormatId[] = targetArg
    ? (ALL_FORMATS.includes(targetArg as FormatId) ? [targetArg as FormatId] : [])
    : ALL_FORMATS

  if (targets.length === 0) {
    console.error(`Unknown format: ${targetArg}`)
    console.error(`Valid formats: ${ALL_FORMATS.join(', ')}`)
    process.exit(1)
  }

  console.log(`Seeding ${targets.length} format(s)...`)
  for (const f of targets) {
    try {
      const r = await seedFormat(f)
      console.log(`  ✓ ${f.padEnd(22)} → /${r.slug} (${r.status})`)
      // Peoria has two QA fixtures: the default (12/18 holes scored — gate
      // closed, secret holes hidden, NET column hidden) and a parallel
      // "-complete" fixture (18/18 — gate open, secret holes revealed, NET
      // column visible). This lets the format-clickthrough script verify both
      // states without manually finishing rounds.
      if (f === 'PEORIA') {
        const c = await seedFormat('PEORIA', { slugSuffix: 'peoria-complete', holesToScore: 18 })
        console.log(`  ✓ ${'PEORIA (complete)'.padEnd(22)} → /${c.slug} (${c.status})`)
      }
    } catch (err) {
      console.error(`  ✗ ${f}: ${err instanceof Error ? err.message : err}`)
    }
  }
  console.log('\nDone. Visit each test tournament at http://localhost:3000/{slug}')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
