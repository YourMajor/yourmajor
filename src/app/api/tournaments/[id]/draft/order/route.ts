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

  const { order } = await req.json() as { order: string[] }
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

  const draft = await prisma.draft.findUnique({ where: { tournamentId } })
  if (!draft) return NextResponse.json({ error: 'No draft found' }, { status: 404 })
  if (draft.status !== 'PENDING') {
    return NextResponse.json({ error: 'Draft order can only be set before the draft starts' }, { status: 400 })
  }

  const updated = await prisma.draft.update({
    where: { tournamentId },
    data: { draftOrder: order },
  })

  return NextResponse.json({ draftOrder: updated.draftOrder })
}
