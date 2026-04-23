import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser, isTournamentAdmin } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (!(await isTournamentAdmin(user.id, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bans = await prisma.chatBan.findMany({
    where: {
      tournamentId: id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { user: { select: { name: true, email: true, image: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(bans)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (!(await isTournamentAdmin(user.id, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, reason, expiresAt } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const ban = await prisma.chatBan.upsert({
    where: { tournamentId_userId: { tournamentId: id, userId } },
    create: {
      tournamentId: id,
      userId,
      reason: reason ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: user.id,
    },
    update: {
      reason: reason ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: user.id,
    },
    include: { user: { select: { name: true, email: true, image: true } } },
  })

  return NextResponse.json(ban, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (!(await isTournamentAdmin(user.id, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  await prisma.chatBan.deleteMany({
    where: { tournamentId: id, userId },
  })

  return NextResponse.json({ success: true })
}
