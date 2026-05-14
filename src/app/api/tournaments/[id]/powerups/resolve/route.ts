import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import {
  CONFIRMATION_ATTACK_COUNT_SLUGS,
  CONFIRMATION_ATTACK_SLUGS,
  validateResolutionModifier,
} from '@/lib/variable-powerup-evaluator'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params
  const { playerPowerupId, scoreModifier } = await req.json() as {
    playerPowerupId: string
    scoreModifier: number
  }

  if (!playerPowerupId || scoreModifier === undefined) {
    return NextResponse.json({ error: 'playerPowerupId and scoreModifier required' }, { status: 400 })
  }

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const playerPowerup = await prisma.playerPowerup.findUnique({
    where: { id: playerPowerupId },
    include: { powerup: { select: { slug: true, effect: true } } },
  })
  if (!playerPowerup) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Attacks are resolved by the target (who can see whether the criteria were
  // met); boosts are resolved by the activator. Authorize accordingly.
  const slug = playerPowerup.powerup.slug
  const isAttack =
    (CONFIRMATION_ATTACK_SLUGS as readonly string[]).includes(slug) ||
    (CONFIRMATION_ATTACK_COUNT_SLUGS as readonly string[]).includes(slug)
  const authorizedPlayerId = isAttack
    ? playerPowerup.targetPlayerId
    : playerPowerup.tournamentPlayerId
  if (!authorizedPlayerId || authorizedPlayerId !== player.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (playerPowerup.status !== 'USED') {
    return NextResponse.json({ error: 'Powerup must be used before resolving' }, { status: 400 })
  }

  // Server-authoritative validation — without this a participant could POST
  // any scoreModifier and rewrite the leaderboard. Yes/no cards must equal
  // 0 or the full effect modifier; count cards must be a non-negative
  // multiple of the effect modifier within the cap.
  const validation = validateResolutionModifier(
    playerPowerup.powerup.slug,
    playerPowerup.powerup.effect as { scoring?: { modifier?: number | null; cap?: number | null } },
    scoreModifier,
  )
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const updated = await prisma.playerPowerup.update({
    where: { id: playerPowerupId },
    data: { scoreModifier },
  })

  return NextResponse.json(updated)
}
