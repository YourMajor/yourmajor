import { NextRequest, NextResponse } from 'next/server'
import { parseBody } from '@/lib/parse-body'
import { z } from 'zod'
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
  const parsed = await parseBody(req, z.object({ roundId: z.string().min(1) }))
  if (!parsed.ok) return parsed.response
  const { roundId } = parsed.data

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { id: true },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  // Scope the round to this tournament, same as activate. Harmless today
  // because finalizeVariablePowerups also filters on the caller's own
  // tournamentPlayerId, but leaving the two siblings asymmetric is how the
  // guard gets missed next time.
  const round = await prisma.tournamentRound.findFirst({
    where: { id: roundId, tournamentId },
    select: { id: true },
  })
  if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 })

  const results = await finalizeVariablePowerups(player.id, roundId)

  return NextResponse.json({ results })
}
