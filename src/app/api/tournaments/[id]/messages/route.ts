import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { containsProfanity } from '@/lib/content-moderation'
import { sendPushToUsers } from '@/lib/push'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a tournament participant' }, { status: 403 })

  const messages = await prisma.tournamentMessage.findMany({
    where: { tournamentId: id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: {
      id: true,
      content: true,
      isSystem: true,
      createdAt: true,
      userId: true,
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
  if (typeof content !== 'string' || content.length > 500) {
    return NextResponse.json({ error: 'Message must be 500 characters or fewer' }, { status: 400 })
  }

  // Verify user is a registered player
  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a tournament participant' }, { status: 403 })

  // Check if user is banned from chat
  const ban = await prisma.chatBan.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
  })
  if (ban) {
    if (!ban.expiresAt || ban.expiresAt > new Date()) {
      return NextResponse.json(
        { error: 'You are restricted from chatting', expiresAt: ban.expiresAt },
        { status: 403 },
      )
    }
    // Ban expired — clean it up
    await prisma.chatBan.delete({ where: { id: ban.id } })
  }

  // Language filter for chat in publicly discoverable tournaments
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { tournamentType: true },
  })
  if (tournament?.tournamentType === 'PUBLIC' && containsProfanity(content)) {
    return NextResponse.json(
      { error: 'Message contains inappropriate language.' },
      { status: 400 },
    )
  }

  const message = await prisma.tournamentMessage.create({
    data: { tournamentId: id, userId: user.id, content: content.trim() },
    include: { user: { select: { name: true, image: true } } },
  })

  // Push runs after the response. A bare setTimeout here did not survive on
  // Vercel — the function can be frozen once the response is sent, so the
  // callback fired late or not at all. The realtime broadcast that lets the
  // service worker suppress a duplicate banner is triggered by the create
  // above, before the response, so it has already gone out by now.
  after(async () => {
    try {
      await dispatchChatPush({
        tournamentId: id,
        authorUserId: user.id,
        authorName: message.user.name ?? 'Someone',
        content: message.content,
      })
    } catch (err) {
      console.error('[push] chat dispatch failed', err)
    }
  })

  return NextResponse.json(message, { status: 201 })
}

async function dispatchChatPush(args: {
  tournamentId: string
  authorUserId: string
  authorName: string
  content: string
}) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: args.tournamentId },
    select: { name: true, slug: true },
  })
  if (!tournament) return

  const recipients = await prisma.tournamentPlayer.findMany({
    where: {
      tournamentId: args.tournamentId,
      isParticipant: true,
      userId: { not: args.authorUserId },
      user: { notifyChatMessages: true },
    },
    select: { userId: true },
  })
  if (recipients.length === 0) return

  const body = `${args.authorName}: ${args.content.slice(0, 80)}${args.content.length > 80 ? '…' : ''}`
  await sendPushToUsers(recipients.map((r) => r.userId), {
    title: tournament.name,
    body,
    url: `/${tournament.slug}`,
  })
}
