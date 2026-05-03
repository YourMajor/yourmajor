import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { containsProfanity } from '@/lib/content-moderation'
import { sendPushToUser } from '@/lib/push'

// Process-local throttle: cap chat-driven pushes from one author in one
// tournament to once per 60s. Resets on lambda lifecycle.
const lastChatPushAt = new Map<string, number>()
const CHAT_PUSH_THROTTLE_MS = 60_000

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

  // Rate limit: 5 messages in 10 seconds triggers a 3-minute auto-mute
  if (checkRateLimit(`${id}:${user.id}`)) {
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000)
    await prisma.chatBan.upsert({
      where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
      create: {
        tournamentId: id,
        userId: user.id,
        reason: 'Auto-muted: sending messages too quickly',
        expiresAt,
        createdBy: 'system',
      },
      update: {
        reason: 'Auto-muted: sending messages too quickly',
        expiresAt,
        createdBy: 'system',
      },
    })
    return NextResponse.json(
      { error: 'Slow down — you are temporarily muted', expiresAt },
      { status: 429 },
    )
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

  // Fire-and-forget push to opted-in participants (excludes author).
  // Throttled per (tournament, author) to keep chat from spamming devices.
  const throttleKey = `${id}:${user.id}`
  const now = Date.now()
  const last = lastChatPushAt.get(throttleKey) ?? 0
  if (now - last >= CHAT_PUSH_THROTTLE_MS) {
    lastChatPushAt.set(throttleKey, now)
    void dispatchChatPush({
      tournamentId: id,
      authorUserId: user.id,
      authorName: message.user.name ?? 'Someone',
      content: message.content,
    }).catch((err) => console.error('[push] chat dispatch failed', err))
  }

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
  const url = `/${tournament.slug}`
  await Promise.allSettled(
    recipients.map((r) =>
      sendPushToUser(r.userId, { title: tournament.name, body, url }),
    ),
  )
}
