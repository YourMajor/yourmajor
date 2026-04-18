/**
 * Seed script — creates a realistic mock tournament with 8 players and scores.
 * Run with: npx tsx prisma/seed.ts
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Augusta-inspired 18-hole layout
const HOLES: Array<{ number: number; par: number; handicap: number }> = [
  { number: 1,  par: 4, handicap: 11 },
  { number: 2,  par: 5, handicap: 3  },
  { number: 3,  par: 4, handicap: 15 },
  { number: 4,  par: 3, handicap: 17 },
  { number: 5,  par: 4, handicap: 7  },
  { number: 6,  par: 3, handicap: 13 },
  { number: 7,  par: 4, handicap: 5  },
  { number: 8,  par: 5, handicap: 1  },
  { number: 9,  par: 4, handicap: 9  },
  { number: 10, par: 4, handicap: 8  },
  { number: 11, par: 4, handicap: 2  },
  { number: 12, par: 3, handicap: 16 },
  { number: 13, par: 5, handicap: 4  },
  { number: 14, par: 4, handicap: 12 },
  { number: 15, par: 5, handicap: 6  },
  { number: 16, par: 3, handicap: 14 },
  { number: 17, par: 4, handicap: 10 },
  { number: 18, par: 4, handicap: 18 },
]

const PAR = HOLES.reduce((s, h) => s + h.par, 0) // 72

// Realistic score offsets per player (vs par per hole, sum gives their rough total)
const PLAYERS: Array<{ name: string; email: string; handicap: number; offsets: number[] }> = [
  {
    name: 'Tiger Woods',
    email: 'tiger@seed.local',
    handicap: 0,
    offsets: [-1,-1,0,0,-1,0,-1,-1,0, 0,-1,0,-1,0,-1,0,0,-1], // 65 (-7)
  },
  {
    name: 'Rory McIlroy',
    email: 'rory@seed.local',
    handicap: 1,
    offsets: [0,-1,0,0,0,0,-1,0,0, 0,0,0,-1,0,0,0,0,0], // 70 (-2)
  },
  {
    name: 'Jon Rahm',
    email: 'jon@seed.local',
    handicap: 2,
    offsets: [0,0,0,1,0,-1,0,-1,0, 0,0,1,0,0,-1,0,0,0], // 71 (-1)
  },
  {
    name: 'Scottie Scheffler',
    email: 'scottie@seed.local',
    handicap: 3,
    offsets: [1,0,0,0,0,0,0,0,0, 0,0,0,-1,1,0,0,0,0], // 73 (+1)
  },
  {
    name: 'Xander Schauffele',
    email: 'xander@seed.local',
    handicap: 5,
    offsets: [0,0,1,0,1,0,0,0,1, 1,0,1,0,0,0,1,0,0], // 77 (+5)
  },
  {
    name: 'Patrick Cantlay',
    email: 'patrick@seed.local',
    handicap: 8,
    offsets: [1,1,0,1,0,1,0,0,0, 1,1,0,0,1,0,1,0,1], // 80 (+8)
  },
  {
    name: 'Viktor Hovland',
    email: 'viktor@seed.local',
    handicap: 12,
    offsets: [1,1,1,1,0,1,1,0,1, 1,0,1,0,1,0,1,1,0], // 83 (+11)
  },
  {
    name: 'Collin Morikawa',
    email: 'collin@seed.local',
    handicap: 15,
    offsets: [2,1,1,1,1,1,0,1,1, 1,1,1,0,1,0,1,1,0], // 87 (+15)
  },
]

async function main() {
  console.log('Seeding mock tournament...')

  // ── Course ──────────────────────────────────────────────────────────────────
  const course = await prisma.course.upsert({
    where: { externalId: 'seed-augusta-mock' },
    update: {},
    create: {
      externalId: 'seed-augusta-mock',
      name: 'Augusta National (Mock)',
      location: 'Augusta, GA',
      par: PAR,
      isCustom: false,
      holes: {
        create: HOLES.map((h) => ({
          number: h.number,
          par: h.par,
          handicap: h.handicap,
        })),
      },
    },
    include: { holes: true },
  })
  console.log(`  Course: ${course.name} (par ${PAR})`)

  // ── Tournament ──────────────────────────────────────────────────────────────
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 2)
  const end = new Date(today)
  end.setDate(today.getDate() + 2)

  const tournament = await prisma.tournament.upsert({
    where: { slug: 'seed-invitational-2026' },
    update: { status: 'ACTIVE', startDate: start, endDate: end },
    create: {
      slug: 'seed-invitational-2026',
      name: 'Seed Invitational 2026',
      primaryColor: '#006747',
      accentColor: '#C9A84C',
      status: 'ACTIVE',
      isOpenRegistration: true,
      handicapSystem: 'WHS',
      startDate: start,
      endDate: end,
    },
  })
  console.log(`  Tournament: ${tournament.name} [${tournament.id}]`)

  // ── Round ────────────────────────────────────────────────────────────────────
  const round = await prisma.tournamentRound.upsert({
    where: { tournamentId_roundNumber: { tournamentId: tournament.id, roundNumber: 1 } },
    update: {},
    create: {
      tournamentId: tournament.id,
      courseId: course.id,
      roundNumber: 1,
      date: today,
    },
  })
  console.log(`  Round 1 created [${round.id}]`)

  // ── Users + TournamentPlayers + Scores ──────────────────────────────────────
  for (let pi = 0; pi < PLAYERS.length; pi++) {
    const p = PLAYERS[pi]

    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name },
      create: { email: p.email, name: p.name },
    })

    const tp = await prisma.tournamentPlayer.upsert({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
      update: { handicap: p.handicap },
      create: {
        tournamentId: tournament.id,
        userId: user.id,
        handicap: p.handicap,
        isAdmin: pi === 0, // Tiger is admin
      },
    })

    // Scores: one per hole
    for (const hole of course.holes) {
      const offset = p.offsets[hole.number - 1] ?? 0
      await prisma.score.upsert({
        where: { tournamentPlayerId_holeId_roundId: { tournamentPlayerId: tp.id, holeId: hole.id, roundId: round.id } },
        update: { strokes: hole.par + offset },
        create: {
          tournamentPlayerId: tp.id,
          holeId: hole.id,
          roundId: round.id,
          strokes: hole.par + offset,
        },
      })
    }

    const gross = p.offsets.reduce((s, o, i) => s + HOLES[i].par + o, 0)
    console.log(`  Player: ${p.name} (HCP ${p.handicap}) — gross ${gross} (${gross - PAR > 0 ? '+' : ''}${gross - PAR})`)
  }

  console.log('\nDone. Visit /seed-invitational-2026 to view the hub.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
