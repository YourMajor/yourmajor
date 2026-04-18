import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { finalizeVariablePowerups } from '@/lib/variable-powerup-evaluator'

/**
 * POST /api/tournaments/[id]/powerups/finalize
 * Force-resolve all ACTIVE variable powerups at end of round.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params
  const { roundId } = await req.json() as { roundId: string }

  if (!roundId) {
    return NextResponse.json({ error: 'roundId is required' }, { status: 400 })
  }

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { id: true },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const results = await finalizeVariablePowerups(player.id, roundId)

  return NextResponse.json({ results })
}
