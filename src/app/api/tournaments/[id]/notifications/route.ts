import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const notifications = await prisma.notification.findMany({
    where: { tournamentPlayerId: player.id, readAt: null },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json(notifications)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params
  const { ids } = await req.json() as { ids: string[] }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  await prisma.notification.updateMany({
    where: {
      id: { in: ids },
      tournamentPlayerId: player.id,
    },
    data: { readAt: new Date() },
  })

  return NextResponse.json({ marked: ids.length })
}
