import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const messages = await prisma.tournamentMessage.findMany({
    where: { tournamentId: id },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: {
      id: true,
      content: true,
      isSystem: true,
      createdAt: true,
      user: { select: { name: true, image: true } },
    },
  })
  return NextResponse.json(messages)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  // Verify user is a registered player
  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a tournament participant' }, { status: 403 })

  const message = await prisma.tournamentMessage.create({
    data: { tournamentId: id, userId: user.id, content: content.trim() },
    include: { user: { select: { name: true, image: true } } },
  })

  return NextResponse.json(message, { status: 201 })
}
