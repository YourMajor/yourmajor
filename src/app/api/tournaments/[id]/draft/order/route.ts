import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function PUT(
  req: NextRequest,
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

  const body = (await req.json()) as { order: string[]; turnSeconds?: number | null }
  const { order, turnSeconds } = body
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: 'order must be a non-empty array of tournamentPlayerIds' }, { status: 400 })
  }

  // Validate all IDs belong to this tournament
  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, isParticipant: true },
    select: { id: true },
  })
  const validIds = new Set(players.map((p) => p.id))
  const invalid = order.filter((id) => !validIds.has(id))
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid player IDs: ${invalid.join(', ')}` }, { status: 400 })
  }

  // Normalize turnSeconds: undefined = leave alone, null/0 = disable, positive int = enable.
  let normalizedTurnSeconds: number | null | undefined = undefined
  if (turnSeconds === null || turnSeconds === 0) {
    normalizedTurnSeconds = null
  } else if (typeof turnSeconds === 'number') {
    if (!Number.isInteger(turnSeconds) || turnSeconds < 5 || turnSeconds > 3600) {
      return NextResponse.json(
        { error: 'turnSeconds must be an integer between 5 and 3600 (or null to disable).' },
        { status: 400 },
      )
    }
    normalizedTurnSeconds = turnSeconds
  }

  const draft = await prisma.draft.findUnique({ where: { tournamentId } })
  if (!draft) return NextResponse.json({ error: 'No draft found' }, { status: 404 })
  if (draft.status !== 'PENDING') {
    return NextResponse.json({ error: 'Draft order can only be set before the draft starts' }, { status: 400 })
  }

  const updated = await prisma.draft.update({
    where: { tournamentId },
    data: {
      draftOrder: order,
      ...(normalizedTurnSeconds !== undefined ? { turnSeconds: normalizedTurnSeconds } : {}),
    },
  })

  return NextResponse.json({ draftOrder: updated.draftOrder, turnSeconds: updated.turnSeconds })
}
