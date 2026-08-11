import { NextRequest, NextResponse } from 'next/server'
import { parseBody } from '@/lib/parse-body'
import { z } from 'zod'
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

  const draft = await prisma.draft.findUnique({
    where: { tournamentId },
    select: { status: true },
  })

  // Once the draft is COMPLETED, suppress (and self-heal) any stale
  // DRAFT_YOUR_TURN rows so the popup can never resurface from old data.
  if (draft?.status === 'COMPLETED') {
    await prisma.notification.updateMany({
      where: {
        tournamentPlayerId: player.id,
        type: 'DRAFT_YOUR_TURN',
        readAt: null,
      },
      data: { readAt: new Date() },
    })
  }

  const notifications = await prisma.notification.findMany({
    where: {
      tournamentPlayerId: player.id,
      readAt: null,
      ...(draft?.status === 'COMPLETED'
        ? { type: { not: 'DRAFT_YOUR_TURN' } }
        : {}),
    },
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
  // Element types were previously unchecked — Array.isArray passes for
  // [1, {}, null], which then went to Prisma as an id filter.
  const parsed = await parseBody(req, z.object({
    ids: z.array(z.string().min(1)).min(1, 'ids array required'),
  }))
  if (!parsed.ok) return parsed.response
  const { ids } = parsed.data

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
