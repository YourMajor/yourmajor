/**
 * Seed script — creates a PUBLIC tournament at Don Valley Golf Course (Toronto)
 * with 8 fake amateur players. Designed to appear in "Open Near You" for users
 * near Thornhill, ON (~15 km away).
 *
 * Run with: npx tsx prisma/seed-nearby.ts
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Don Valley Golf Course — realistic 18-hole layout (par 71)
const HOLES: Array<{ number: number; par: number; handicap: number }> = [
  { number: 1,  par: 4, handicap: 7  },
  { number: 2,  par: 4, handicap: 3  },
  { number: 3,  par: 3, handicap: 15 },
  { number: 4,  par: 5, handicap: 1  },
  { number: 5,  par: 4, handicap: 11 },
  { number: 6,  par: 4, handicap: 5  },
  { number: 7,  par: 3, handicap: 17 },
  { number: 8,  par: 4, handicap: 9  },
  { number: 9,  par: 4, handicap: 13 },
  { number: 10, par: 4, handicap: 6  },
  { number: 11, par: 5, handicap: 2  },
  { number: 12, par: 3, handicap: 16 },
  { number: 13, par: 4, handicap: 10 },
  { number: 14, par: 4, handicap: 4  },
  { number: 15, par: 4, handicap: 8  },
  { number: 16, par: 5, handicap: 14 },
  { number: 17, par: 3, handicap: 18 },
  { number: 18, par: 4, handicap: 12 },
]

const PAR = HOLES.reduce((s, h) => s + h.par, 0) // 71

// Yardages per hole for each tee (Blue / White / Red)
const YARDAGES: Array<{ blue: number; white: number; red: number }> = [
  { blue: 395, white: 365, red: 310 },
  { blue: 420, white: 385, red: 335 },
  { blue: 185, white: 160, red: 135 },
  { blue: 540, white: 505, red: 455 },
  { blue: 375, white: 345, red: 295 },
  { blue: 410, white: 380, red: 330 },
  { blue: 175, white: 150, red: 125 },
  { blue: 390, white: 360, red: 315 },
  { blue: 405, white: 370, red: 320 },
  { blue: 430, white: 395, red: 340 },
  { blue: 555, white: 520, red: 465 },
  { blue: 195, white: 170, red: 140 },
  { blue: 385, white: 350, red: 300 },
  { blue: 415, white: 380, red: 330 },
  { blue: 400, white: 370, red: 320 },
  { blue: 530, white: 495, red: 445 },
  { blue: 200, white: 175, red: 145 },
  { blue: 425, white: 390, red: 340 },
]

const TEES: Array<{ name: string; color: string; key: keyof (typeof YARDAGES)[0] }> = [
  { name: 'Blue',  color: 'blue',  key: 'blue'  },
  { name: 'White', color: 'white', key: 'white' },
  { name: 'Red',   color: 'red',   key: 'red'   },
]

const PLAYERS: Array<{ name: string; email: string; handicap: number }> = [
  { name: 'Marco Pellegrini',  email: 'marco.pellegrini@nearby.local',  handicap: 14 },
  { name: 'Sarah Chen',        email: 'sarah.chen@nearby.local',        handicap: 18 },
  { name: 'Doug MacPherson',   email: 'doug.macpherson@nearby.local',   handicap: 22 },
  { name: 'Priya Sharma',      email: 'priya.sharma@nearby.local',      handicap: 9  },
  { name: 'Liam O\'Reilly',    email: 'liam.oreilly@nearby.local',      handicap: 27 },
  { name: 'Kenji Watanabe',    email: 'kenji.watanabe@nearby.local',    handicap: 11 },
  { name: 'Alicia Ferreira',   email: 'alicia.ferreira@nearby.local',   handicap: 16 },
  { name: 'Brett Lawson',      email: 'brett.lawson@nearby.local',      handicap: 32 },
]

async function main() {
  console.log('Seeding Don Valley Spring Open (nearby tournament)...\n')

  // ── Course ──────────────────────────────────────────────────────────────────
  const course = await prisma.course.upsert({
    where: { externalId: 'seed-don-valley' },
    update: { latitude: 43.692, longitude: -79.358 },
    create: {
      externalId: 'seed-don-valley',
      name: 'Don Valley Golf Course',
      location: 'Toronto, ON',
      latitude: 43.692,
      longitude: -79.358,
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
    include: { holes: { orderBy: { number: 'asc' } } },
  })
  console.log(`  Course: ${course.name} (par ${PAR})`)

  // ── Tee Options + Yardages (delete+recreate for idempotency) ────────────────
  await prisma.holeYardage.deleteMany({
    where: { teeOption: { courseId: course.id } },
  })
  await prisma.teeOption.deleteMany({ where: { courseId: course.id } })

  for (const tee of TEES) {
    const totalYards = YARDAGES.reduce((s, y) => s + y[tee.key], 0)
    const teeOption = await prisma.teeOption.create({
      data: { courseId: course.id, name: tee.name, color: tee.color },
    })

    await prisma.holeYardage.createMany({
      data: course.holes.map((hole, i) => ({
        holeId: hole.id,
        teeOptionId: teeOption.id,
        yards: YARDAGES[i][tee.key],
      })),
    })
    console.log(`  Tee: ${tee.name} (${totalYards} yards)`)
  }

  // ── Tournament ──────────────────────────────────────────────────────────────
  const start = new Date('2026-04-25')
  const end = new Date('2026-04-26')

  const tournament = await prisma.tournament.upsert({
    where: { slug: 'don-valley-spring-open-2026' },
    update: { status: 'REGISTRATION', tournamentType: 'PUBLIC', endDate: end },
    create: {
      slug: 'don-valley-spring-open-2026',
      name: 'Don Valley Spring Open 2026',
      description:
        'Open registration 2-day spring tournament at Don Valley Golf Course. All skill levels welcome!',
      primaryColor: '#1A5632',
      accentColor: '#D4A843',
      status: 'REGISTRATION',
      tournamentType: 'PUBLIC',
      isOpenRegistration: true,
      handicapSystem: 'WHS',
      startDate: start,
      endDate: end,
    },
  })
  console.log(`  Tournament: ${tournament.name} [${tournament.status}]`)

  // ── Round ────────────────────────────────────────────────────────────────────
  await prisma.tournamentRound.upsert({
    where: {
      tournamentId_roundNumber: {
        tournamentId: tournament.id,
        roundNumber: 1,
      },
    },
    update: {},
    create: {
      tournamentId: tournament.id,
      courseId: course.id,
      roundNumber: 1,
      date: start,
    },
  })
  console.log(`  Round 1: Apr 25, 2026`)

  // ── Users + TournamentPlayers ───────────────────────────────────────────────
  for (let i = 0; i < PLAYERS.length; i++) {
    const p = PLAYERS[i]

    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name },
      create: { email: p.email, name: p.name },
    })

    await prisma.tournamentPlayer.upsert({
      where: {
        tournamentId_userId: {
          tournamentId: tournament.id,
          userId: user.id,
        },
      },
      update: { handicap: p.handicap },
      create: {
        tournamentId: tournament.id,
        userId: user.id,
        handicap: p.handicap,
        isAdmin: i === 0,
      },
    })

    console.log(
      `  Player: ${p.name} (HCP ${p.handicap})${i === 0 ? ' — admin' : ''}`,
    )
  }

  console.log(
    '\nDone. This tournament will appear in "Open Near You" for users near Thornhill, ON.',
  )
  console.log('Visit /don-valley-spring-open-2026 to view the hub.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
