import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { findPendingConfirmations } from '@/lib/variable-powerup-evaluator'

/**
 * GET /api/tournaments/[id]/powerups/pending-confirmations?roundId=...
 * Returns confirmations the current player still needs to answer (Yes/No on
 * Big Brother / Caddy's Pick / Showdown / Twinning / Drink Up / Long & Winding).
 * Caller answers with POST /api/tournaments/[id]/powerups/resolve.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params
  const roundId = req.nextUrl.searchParams.get('roundId')
  if (!roundId) return NextResponse.json({ error: 'roundId query param required' }, { status: 400 })

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { id: true },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const pendingConfirmations = await findPendingConfirmations(player.id, roundId)
  return NextResponse.json({ pendingConfirmations })
}
