/**
 * Seed script — creates a test league at Pipers Heath with 30 players,
 * 3 completed Wednesday events and 1 upcoming.
 * Run with: npx tsx prisma/seed-league.ts
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Pipers Heath Golf Club - realistic 18-hole layout (par 72)
const HOLES: Array<{ number: number; par: number; handicap: number }> = [
  { number: 1,  par: 4, handicap: 7  },
  { number: 2,  par: 4, handicap: 11 },
  { number: 3,  par: 3, handicap: 15 },
  { number: 4,  par: 5, handicap: 1  },
  { number: 5,  par: 4, handicap: 5  },
  { number: 6,  par: 4, handicap: 9  },
  { number: 7,  par: 3, handicap: 17 },
  { number: 8,  par: 5, handicap: 3  },
  { number: 9,  par: 4, handicap: 13 },
  { number: 10, par: 4, handicap: 8  },
  { number: 11, par: 5, handicap: 2  },
  { number: 12, par: 3, handicap: 16 },
  { number: 13, par: 4, handicap: 6  },
  { number: 14, par: 4, handicap: 10 },
  { number: 15, par: 4, handicap: 4  },
  { number: 16, par: 3, handicap: 18 },
  { number: 17, par: 5, handicap: 12 },
  { number: 18, par: 4, handicap: 14 },
]

const PAR = HOLES.reduce((s, h) => s + h.par, 0) // 72

// Stock avatar URLs (Unsplash golf/portrait photos)
const AVATARS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=150&h=150&fit=crop&crop=face',
]

// 30 players with realistic handicaps
const PLAYERS = [
  { name: 'Mike Thornton',     handicap: 4  },
  { name: 'Dave Callahan',     handicap: 7  },
  { name: 'Steve Park',        handicap: 10 },
  { name: 'Rob Nasser',        handicap: 12 },
  { name: 'Chris Daly',        handicap: 5  },
  { name: 'James Liu',         handicap: 15 },
  { name: 'Tom Hennessey',     handicap: 8  },
  { name: 'Brian Moretti',     handicap: 18 },
  { name: 'Kevin O\'Brien',    handicap: 6  },
  { name: 'Dan Fitzpatrick',   handicap: 11 },
  { name: 'Mark Sanderson',    handicap: 20 },
  { name: 'Greg Whitfield',    handicap: 9  },
  { name: 'Paul Marchetti',    handicap: 14 },
  { name: 'Scott Beaudoin',    handicap: 3  },
  { name: 'Andy Kim',          handicap: 16 },
  { name: 'Jeff Blackwell',    handicap: 22 },
  { name: 'Matt Savard',       handicap: 7  },
  { name: 'Jason Tremblay',    handicap: 13 },
  { name: 'Derek Nguyen',      handicap: 2  },
  { name: 'Ryan Ostrowski',    handicap: 19 },
  { name: 'Nathan Cole',       handicap: 6  },
  { name: 'Tyler Gorman',      handicap: 11 },
  { name: 'Adam Dasilva',      handicap: 25 },
  { name: 'Ben Charlebois',    handicap: 8  },
  { name: 'Luke Proulx',       handicap: 17 },
  { name: 'Sean Baxter',       handicap: 5  },
  { name: 'Nick Leblanc',      handicap: 10 },
  { name: 'Jordan Singh',      handicap: 14 },
  { name: 'Alex Moreau',       handicap: 21 },
  { name: 'Eric Fontaine',     handicap: 9  },
]

// Wednesdays: Apr 1, Apr 8, Apr 15, Apr 22
const WEDNESDAYS = [
  new Date('2026-04-01T18:00:00'),
  new Date('2026-04-08T18:00:00'),
  new Date('2026-04-15T18:00:00'),
  new Date('2026-04-22T18:00:00'),
]

// Generate a realistic score for a hole given player handicap
function generateScore(holePar: number, holeHandicap: number, playerHandicap: number, seed: number): number {
  // Better players (lower handicap) score closer to par
  const r = pseudoRandom(seed)
  const skillFactor = playerHandicap / 36 // 0..~0.7

  if (r < 0.02 && holePar >= 4) return holePar - 2 // eagle (rare)
  if (r < 0.12 - skillFactor * 0.08) return holePar - 1 // birdie
  if (r < 0.45 - skillFactor * 0.2) return holePar // par
  if (r < 0.75) return holePar + 1 // bogey
  if (r < 0.90) return holePar + 2 // double
  return holePar + Math.floor(r * 3) + 1 // triple+
}

// Simple seeded pseudo-random
let _seed = 42
function pseudoRandom(extra: number): number {
  _seed = (_seed * 1103515245 + 12345 + extra) & 0x7fffffff
  return (_seed % 10000) / 10000
}

// Generate fairway/GIR/putts
function generateStats(holePar: number, strokes: number, seed: number) {
  const r = pseudoRandom(seed)
  const fairwayHit = holePar >= 4 ? r > 0.35 : null // no fairway on par 3s
  const gir = strokes <= holePar ? r > 0.3 : r > 0.7
  const putts = strokes <= holePar ? (r > 0.6 ? 1 : 2) : (r > 0.4 ? 2 : 3)
  return { fairwayHit, gir, putts }
}

async function main() {
  console.log('Seeding Wednesday Night League at Pipers Heath...\n')

  // ── Course ──
  const course = await prisma.course.upsert({
    where: { externalId: 'pipers-heath-thornhill' },
    update: {},
    create: {
      externalId: 'pipers-heath-thornhill',
      name: 'Pipers Heath Golf Club',
      location: 'Thornhill, ON',
      latitude: 43.8150,
      longitude: -79.4440,
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
  console.log(`Course: ${course.name} (par ${PAR})`)

  // ── Create 30 users ──
  const users = []
  for (let i = 0; i < PLAYERS.length; i++) {
    const p = PLAYERS[i]
    const email = `${p.name.toLowerCase().replace(/[^a-z]/g, '.')}@league.local`
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: p.name, image: AVATARS[i % AVATARS.length] },
      create: { email, name: p.name, image: AVATARS[i % AVATARS.length] },
    })
    // Ensure profile exists
    await prisma.playerProfile.upsert({
      where: { userId: user.id },
      update: { handicap: p.handicap },
      create: { userId: user.id, handicap: p.handicap, displayName: p.name },
    })
    users.push({ user, handicap: p.handicap, name: p.name })
  }
  console.log(`Created ${users.length} players`)

  // ── Stock images for tournament ──
  const HEADER_IMAGE = 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=1200&h=400&fit=crop'
  const LOGO_IMAGE = 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=200&h=200&fit=crop'

  // ── Create 4 chained tournaments (3 completed + 1 upcoming) ──
  let parentId: string | null = null
  const tournaments: Array<{ id: string; slug: string; weekIdx: number }> = []

  for (let w = 0; w < 4; w++) {
    const weekDate = WEDNESDAYS[w]
    const weekNum = w + 1
    const isCompleted = w < 3
    const isUpcoming = w === 3
    const slug = `wednesday-league-wk${weekNum}`

    const tournament: { id: string; slug: string } = await prisma.tournament.upsert({
      where: { slug },
      update: {
        status: isCompleted ? 'COMPLETED' : 'REGISTRATION',
        startDate: weekDate,
        endDate: weekDate,
        parentTournamentId: parentId,
        isLeague: true,
        seasonScoringMethod: w === 0 ? 'POINTS' : undefined,
      },
      create: {
        slug,
        name: 'Wednesday Night League',
        description: 'Weekly league at Pipers Heath. All skill levels welcome.',
        logo: LOGO_IMAGE,
        headerImage: HEADER_IMAGE,
        primaryColor: '#1B4332',
        accentColor: '#D4A843',
        status: isCompleted ? 'COMPLETED' : 'REGISTRATION',
        isOpenRegistration: true,
        handicapSystem: 'WHS',
        startDate: weekDate,
        endDate: weekDate,
        parentTournamentId: parentId,
        isLeague: true,
        seasonScoringMethod: w === 0 ? 'POINTS' : undefined,
      },
    })

    tournaments.push({ id: tournament.id, slug, weekIdx: w })
    console.log(`\nWeek ${weekNum} (${weekDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}): ${tournament.slug} [${isCompleted ? 'COMPLETED' : 'REGISTRATION'}]`)

    // Create round
    const round = await prisma.tournamentRound.upsert({
      where: { tournamentId_roundNumber: { tournamentId: tournament.id, roundNumber: 1 } },
      update: { date: weekDate },
      create: {
        tournamentId: tournament.id,
        courseId: course.id,
        roundNumber: 1,
        date: weekDate,
      },
    })

    // Randomly pick ~22-28 players per completed week (not everyone shows up every week)
    // For upcoming week, register all 30
    const playerCount = isUpcoming ? 30 : 22 + Math.floor(pseudoRandom(w * 100) * 7)
    const shuffled = [...users].sort(() => pseudoRandom(w * 1000 + users.length) - 0.5)
    const weekPlayers = isUpcoming ? users : shuffled.slice(0, playerCount)

    for (let pi = 0; pi < weekPlayers.length; pi++) {
      const { user, handicap, name } = weekPlayers[pi]

      const tp = await prisma.tournamentPlayer.upsert({
        where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
        update: { handicap },
        create: {
          tournamentId: tournament.id,
          userId: user.id,
          handicap,
          isAdmin: user.email === 'mike.thornton@league.local',
        },
      })

      // Generate scores for completed events
      if (isCompleted) {
        let grossTotal = 0
        for (const hole of course.holes) {
          const scoreSeed = w * 10000 + pi * 100 + hole.number
          const strokes = generateScore(hole.par, hole.handicap ?? hole.number, handicap, scoreSeed)
          grossTotal += strokes
          const stats = generateStats(hole.par, strokes, scoreSeed + 50000)

          await prisma.score.upsert({
            where: { tournamentPlayerId_holeId_roundId: { tournamentPlayerId: tp.id, holeId: hole.id, roundId: round.id } },
            update: { strokes, fairwayHit: stats.fairwayHit, gir: stats.gir, putts: stats.putts },
            create: {
              tournamentPlayerId: tp.id,
              holeId: hole.id,
              roundId: round.id,
              strokes,
              fairwayHit: stats.fairwayHit,
              gir: stats.gir,
              putts: stats.putts,
            },
          })
        }
        const vsPar = grossTotal - PAR
        if (pi < 5) {
          console.log(`  ${name} (HCP ${handicap}): ${grossTotal} (${vsPar > 0 ? '+' : ''}${vsPar})`)
        }
      }
    }

    // Set champion for completed events
    if (isCompleted) {
      // Find the winner by importing the leaderboard logic
      const { getLeaderboard } = await import('../src/lib/scoring')
      const standings = await getLeaderboard(tournament.id)
      const champion = standings[0]
      if (champion) {
        const champTp = await prisma.tournamentPlayer.findUnique({
          where: { id: champion.tournamentPlayerId },
          select: { userId: true },
        })
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: {
            championUserId: champTp?.userId ?? null,
            championName: champion.playerName,
          },
        })
        console.log(`  Champion: ${champion.playerName} (${champion.grossVsPar! > 0 ? '+' : ''}${champion.grossVsPar})`)
      }
    }

    console.log(`  ${weekPlayers.length} players ${isCompleted ? 'played' : 'registered'}`)
    parentId = tournament.id
  }

  // ── Add hartleyfanson@gmail.com as admin of all events ──
  const adminEmail = 'hartleyfanson@gmail.com'
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (adminUser) {
    for (const t of tournaments) {
      await prisma.tournamentPlayer.upsert({
        where: { tournamentId_userId: { tournamentId: t.id, userId: adminUser.id } },
        update: { isAdmin: true },
        create: {
          tournamentId: t.id,
          userId: adminUser.id,
          isAdmin: true,
          handicap: 0,
        },
      }).catch(() => {})
    }
    console.log(`\nAdmin: ${adminEmail} added to all events`)
  } else {
    console.log(`\nWARN: ${adminEmail} not found in database — log in first, then re-run seed`)
  }

  // ── Create league roster ──
  const rootId = tournaments[0].id
  const roster = await prisma.leagueRoster.upsert({
    where: { rootTournamentId: rootId },
    update: {},
    create: {
      rootTournamentId: rootId,
      autoAddNew: true,
    },
  })

  // Add all 30 players to roster
  for (const { user } of users) {
    await prisma.leagueRosterMember.upsert({
      where: { rosterId_userId: { rosterId: roster.id, userId: user.id } },
      update: {},
      create: {
        rosterId: roster.id,
        userId: user.id,
        status: 'ACTIVE',
      },
    }).catch(() => {}) // ignore duplicates
  }
  // Add admin to roster too
  if (adminUser) {
    await prisma.leagueRosterMember.upsert({
      where: { rosterId_userId: { rosterId: roster.id, userId: adminUser.id } },
      update: {},
      create: { rosterId: roster.id, userId: adminUser.id, status: 'ACTIVE' },
    }).catch(() => {})
  }
  console.log(`\nRoster: ${users.length + (adminUser ? 1 : 0)} members`)

  // ── Create schedule event for next Wednesday ──
  const nextWednesday = WEDNESDAYS[3]
  await prisma.seasonScheduleEvent.create({
    data: {
      tournamentId: rootId,
      title: 'Week 4 — Wednesday Night League',
      date: nextWednesday,
      notes: 'Shotgun start at 5:30 PM. Dinner to follow.',
    },
  }).catch(() => {}) // ignore if already exists
  console.log(`Schedule: Week 4 on ${nextWednesday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`)

  console.log('\n✓ Done! Visit /wednesday-league-wk4 to see the latest league page.')
  console.log('  Season standings: /wednesday-league-wk4/season')
  console.log('  Admin: /wednesday-league-wk4/admin/season')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
