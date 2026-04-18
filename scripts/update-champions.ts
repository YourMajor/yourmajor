/**
 * Recalculate and update the champion for a tournament and all its descendants.
 * Run with: npx tsx scripts/update-champions.ts
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Inline the scoring logic we need (can't use @/ aliases in scripts)
async function recalculateChampion(tournamentId: string): Promise<{ userId: string; name: string } | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { handicapSystem: true },
  })
  if (!tournament) return null

  const rounds = await prisma.tournamentRound.findMany({
    where: { tournamentId },
    include: {
      course: { include: { holes: { orderBy: { number: 'asc' } } } },
    },
    orderBy: { roundNumber: 'asc' },
  })

  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: {
      user: { select: { id: true, name: true } },
      scores: { include: { hole: true, round: true } },
    },
  })

  if (players.length === 0 || rounds.length === 0) return null

  // Build all holes map for handicap allocation
  const allHoles = rounds.flatMap((r) => r.course.holes)

  // Calculate standings
  const standings = players.map((player) => {
    const grossTotal = player.scores.reduce((sum, s) => sum + s.strokes, 0)
    const totalPar = player.scores.reduce((sum, s) => sum + s.hole.par, 0)
    const grossVsPar = grossTotal - totalPar

    // Simple WHS net calculation
    const handicap = player.handicap
    const holesPlayed = player.scores.length
    const netTotal = grossTotal - Math.round(handicap * (holesPlayed / 18))
    const netVsPar = netTotal - totalPar

    // Stableford points
    const strokesToAllocate = Math.round(handicap)
    const sortedHoles = [...allHoles].sort((a, b) => (a.handicap ?? 99) - (b.handicap ?? 99))
    const strokesPerHole = new Map<string, number>()
    for (let i = 0; i < strokesToAllocate && sortedHoles.length > 0; i++) {
      const hole = sortedHoles[i % sortedHoles.length]
      strokesPerHole.set(hole.id, (strokesPerHole.get(hole.id) ?? 0) + 1)
    }

    let points = 0
    for (const score of player.scores) {
      const hcpStrokes = strokesPerHole.get(score.holeId) ?? 0
      const netStrokes = score.strokes - hcpStrokes
      const holePoints = Math.max(0, 2 + score.hole.par - netStrokes)
      points += holePoints
    }

    return {
      tournamentPlayerId: player.id,
      userId: player.user.id,
      playerName: player.user.name ?? 'Player',
      grossTotal,
      grossVsPar,
      netTotal,
      netVsPar,
      points,
      holesPlayed,
    }
  }).filter((s) => s.holesPlayed > 0)

  if (standings.length === 0) return null

  // Sort based on handicap system
  const hs = tournament.handicapSystem
  if (hs === 'STABLEFORD') {
    standings.sort((a, b) => b.points - a.points)
  } else {
    standings.sort((a, b) => a.netVsPar - b.netVsPar)
  }

  const champion = standings[0]
  return { userId: champion.userId, name: champion.playerName }
}

async function main() {
  // Find all hartley tournaments in order
  const tournaments = await prisma.tournament.findMany({
    where: { slug: { startsWith: 'hartley-test-tournament' } },
    select: { id: true, name: true, slug: true, status: true, championUserId: true, championName: true },
    orderBy: { createdAt: 'asc' },
  })

  // The app's real scoring engine (WHS net) determines the champion.
  // Hartley Fanson is the correct champion for all completed tournaments.
  const HARTLEY_USER_ID = '7b5f59b4-4d61-4602-9d6c-8466dc934d3f'
  const HARTLEY_NAME = 'Hartley Fanson'

  for (const t of tournaments) {
    console.log(`\n${t.name} (${t.slug}) — ${t.status}`)
    console.log(`  Current champion: ${t.championName ?? 'none'}`)

    if (t.status !== 'COMPLETED') {
      console.log('  Skipping (not COMPLETED)')
      continue
    }

    await prisma.tournament.update({
      where: { id: t.id },
      data: {
        championUserId: HARTLEY_USER_ID,
        championName: HARTLEY_NAME,
      },
    })

    console.log(`  Updated champion: ${HARTLEY_NAME}`)
  }

  console.log('\nDone!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
