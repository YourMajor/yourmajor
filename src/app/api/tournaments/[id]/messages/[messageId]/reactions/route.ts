import { NextRequest, NextResponse } from 'next/server'
import { parseBody } from '@/lib/parse-body'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { resolveChatAccess } from '@/lib/chat-access'
import { isChatReaction } from '@/lib/chat-reactions'

/**
 * Toggle the caller's emoji reaction on a chat message: adds it, or removes
 * it if they'd already reacted with that emoji. Same access rule as posting.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId, messageId } = await params
  const parsed = await parseBody(req, z.object({ emoji: z.string().min(1).max(16) }))
  if (!parsed.ok) return parsed.response
  const { emoji } = parsed.data
  if (!isChatReaction(emoji)) {
    return NextResponse.json({ error: 'Unsupported reaction' }, { status: 400 })
  }

  const access = await resolveChatAccess(tournamentId, user.id, { enrollAsWatcher: true })
  if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status })

  const ban = await prisma.chatBan.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { expiresAt: true },
  })
  if (ban && (!ban.expiresAt || ban.expiresAt > new Date())) {
    return NextResponse.json({ error: 'You are restricted from chatting' }, { status: 403 })
  }

  const message = await prisma.tournamentMessage.findUnique({
    where: { id: messageId },
    select: { tournamentId: true, deletedAt: true },
  })
  if (!message || message.tournamentId !== tournamentId || message.deletedAt) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const key = { messageId_userId_emoji: { messageId, userId: user.id, emoji } }
  const existing = await prisma.messageReaction.findUnique({ where: key, select: { id: true } })
  let reacted: boolean
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } })
    reacted = false
  } else {
    try {
      await prisma.messageReaction.create({ data: { messageId, userId: user.id, emoji } })
    } catch (err) {
      // Double tap raced the first create — already reacted, which is the goal.
      if ((err as { code?: string } | null)?.code !== 'P2002') throw err
    }
    reacted = true
  }

  // Touch the message so realtime's UPDATE event makes every open chat refetch.
  await prisma.tournamentMessage.update({ where: { id: messageId }, data: { reactedAt: new Date() } })

  return NextResponse.json({ reacted, emoji })
}
