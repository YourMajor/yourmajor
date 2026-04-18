import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params

  // Verify admin
  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { isAdmin: true },
  })
  if (!membership?.isAdmin && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { powerupsPerPlayer: true, maxAttacksPerPlayer: true },
  })
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    select: { id: true },
  })

  if (players.length === 0) {
    return NextResponse.json({ error: 'No players registered' }, { status: 400 })
  }

  // Check if powerups already dealt
  const existing = await prisma.playerPowerup.count({
    where: { tournamentPlayerId: { in: players.map((p) => p.id) } },
  })
  if (existing > 0) {
    return NextResponse.json({ error: 'Powerups have already been distributed' }, { status: 400 })
  }

  // Get all available powerups
  const allPowerups = await prisma.tournamentPowerup.findMany({
    where: { tournamentId },
    include: { powerup: { select: { id: true, type: true } } },
  })

  const boosts = allPowerups.filter((tp) => tp.powerup.type === 'BOOST').map((tp) => tp.powerup)
  const attacks = allPowerups.filter((tp) => tp.powerup.type === 'ATTACK').map((tp) => tp.powerup)

  const { powerupsPerPlayer, maxAttacksPerPlayer } = tournament
  const playerCount = players.length

  // Build a deck for each player respecting maxAttacksPerPlayer
  const shuffledBoosts = shuffle(boosts)
  const shuffledAttacks = shuffle(attacks)

  const assignments: Array<{ tournamentPlayerId: string; powerupId: string }> = []
  let boostIdx = 0
  let attackIdx = 0

  for (const player of players) {
    let attacksGiven = 0

    for (let i = 0; i < powerupsPerPlayer; i++) {
      // Try to give an attack card if under limit and attacks available
      if (attacksGiven < maxAttacksPerPlayer && attackIdx < shuffledAttacks.length) {
        assignments.push({
          tournamentPlayerId: player.id,
          powerupId: shuffledAttacks[attackIdx].id,
        })
        attackIdx++
        attacksGiven++
      } else if (boostIdx < shuffledBoosts.length) {
        assignments.push({
          tournamentPlayerId: player.id,
          powerupId: shuffledBoosts[boostIdx].id,
        })
        boostIdx++
      } else if (attackIdx < shuffledAttacks.length && attacksGiven < maxAttacksPerPlayer) {
        // Fall back to attack if no boosts left
        assignments.push({
          tournamentPlayerId: player.id,
          powerupId: shuffledAttacks[attackIdx].id,
        })
        attackIdx++
        attacksGiven++
      }
      // If both pools exhausted, some players may get fewer cards
    }
  }

  // Create all PlayerPowerup records
  await prisma.playerPowerup.createMany({
    data: assignments.map((a) => ({
      tournamentPlayerId: a.tournamentPlayerId,
      powerupId: a.powerupId,
      status: 'AVAILABLE' as const,
    })),
  })

  // Notify all players
  await prisma.notification.createMany({
    data: players.map((p) => ({
      tournamentPlayerId: p.id,
      type: 'DRAFT_COMPLETED' as const,
      payload: { message: 'Powerups have been randomly dealt! Check your hand.' },
    })),
  })

  return NextResponse.json({
    dealt: assignments.length,
    perPlayer: powerupsPerPlayer,
    playerCount,
  })
}
