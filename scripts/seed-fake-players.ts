/**
 * Seed 8 fake players with realistic scorecards into an existing tournament.
 * Run with: npx tsx scripts/seed-fake-players.ts
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const SLUG = 'hartley-test-tournament'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// 8 fake players with varied handicaps and deterministic per-hole offsets vs par
// Offsets are for 18 holes; sum + 72 = gross score
const FAKE_PLAYERS: Array<{ name: string; email: string; handicap: number; offsets: number[] }> = [
  {
    name: 'James Sullivan',
    email: 'james.sullivan@fake.local',
    handicap: 4,
    offsets: [0,0,-1,0,0,1,0,0,0, 0,1,0,-1,0,0,1,0,0], // 73 (+1)
  },
  {
    name: 'Mike Chen',
    email: 'mike.chen@fake.local',
    handicap: 8,
    offsets: [0,1,0,0,1,0,0,0,1, 0,1,0,0,1,0,0,0,1], // 78 (+6)
  },
  {
    name: 'Dave Thompson',
    email: 'dave.thompson@fake.local',
    handicap: 12,
    offsets: [1,0,1,0,1,0,1,0,0, 1,0,1,0,1,0,1,0,1], // 80 (+8)
  },
  {
    name: 'Chris Anderson',
    email: 'chris.anderson@fake.local',
    handicap: 16,
    offsets: [1,1,0,1,1,0,1,0,1, 1,1,0,1,1,0,1,0,1], // 84 (+12)
  },
  {
    name: "Ryan O'Brien",
    email: 'ryan.obrien@fake.local',
    handicap: 20,
    offsets: [1,1,1,1,1,0,1,1,1, 1,1,1,0,1,1,1,1,1], // 88 (+16)
  },
  {
    name: 'Tom Kowalski',
    email: 'tom.kowalski@fake.local',
    handicap: 6,
    offsets: [0,0,0,1,0,0,-1,0,1, 0,0,1,0,0,-1,1,0,0], // 74 (+2)
  },
  {
    name: 'Nick Patel',
    email: 'nick.patel@fake.local',
    handicap: 14,
    offsets: [1,0,1,1,0,1,0,1,0, 1,0,1,1,0,1,0,1,0], // 81 (+9)
  },
  {
    name: 'Ben Martinez',
    email: 'ben.martinez@fake.local',
    handicap: 24,
    offsets: [2,1,1,1,2,1,1,1,1, 2,1,1,1,2,1,1,1,1], // 94 (+22)
  },
]

async function main() {
  console.log(`Seeding fake players into tournament: ${SLUG}`)

  // Find the tournament
  const tournament = await prisma.tournament.findUnique({
    where: { slug: SLUG },
    select: { id: true, name: true, status: true },
  })
  if (!tournament) {
    console.error(`Tournament with slug "${SLUG}" not found!`)
    process.exit(1)
  }
  console.log(`  Found: ${tournament.name} [${tournament.id}] (${tournament.status})`)

  // Get all rounds with their course holes
  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId: tournament.id },
    include: {
      course: {
        include: { holes: { orderBy: { number: 'asc' } } },
      },
    },
    orderBy: { roundNumber: 'asc' },
  })

  if (rounds.length === 0) {
    console.error('  No rounds found for this tournament. Create at least one round first.')
    process.exit(1)
  }

  console.log(`  Rounds: ${rounds.length}`)
  for (const r of rounds) {
    console.log(`    Round ${r.roundNumber}: ${r.course.name} (${r.course.holes.length} holes, par ${r.course.par})`)
  }

  // Create users, tournament players, and scores
  for (const fp of FAKE_PLAYERS) {
    const user = await prisma.user.upsert({
      where: { email: fp.email },
      update: { name: fp.name },
      create: { email: fp.email, name: fp.name },
    })

    const tp = await prisma.tournamentPlayer.upsert({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
      update: { handicap: fp.handicap },
      create: {
        tournamentId: tournament.id,
        userId: user.id,
        handicap: fp.handicap,
        isAdmin: false,
      },
    })

    // Create scores for each round
    for (const round of rounds) {
      let totalStrokes = 0
      for (const hole of round.course.holes) {
        const offset = fp.offsets[hole.number - 1] ?? 0
        const strokes = hole.par + offset
        totalStrokes += strokes
        await prisma.score.upsert({
          where: {
            tournamentPlayerId_holeId_roundId: {
              tournamentPlayerId: tp.id,
              holeId: hole.id,
              roundId: round.id,
            },
          },
          update: { strokes },
          create: {
            tournamentPlayerId: tp.id,
            holeId: hole.id,
            roundId: round.id,
            strokes,
          },
        })
      }

      const coursePar = round.course.holes.reduce((s, h) => s + h.par, 0)
      const diff = totalStrokes - coursePar
      console.log(`  ${fp.name} (HCP ${fp.handicap}) — Round ${round.roundNumber}: ${totalStrokes} (${diff >= 0 ? '+' : ''}${diff})`)
    }
  }

  console.log('\nDone! 8 fake players with scores added.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
