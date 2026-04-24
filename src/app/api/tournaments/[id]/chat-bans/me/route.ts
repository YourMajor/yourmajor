import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const ban = await prisma.chatBan.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
  })

  if (!ban) return NextResponse.json({ banned: false })

  if (ban.expiresAt && ban.expiresAt <= new Date()) {
    // Keep ban cleanup consistent with POST /messages — expired rows get
    // removed whenever encountered so the DB doesn't accumulate dead state.
    await prisma.chatBan.delete({ where: { id: ban.id } })
    return NextResponse.json({ banned: false })
  }

  return NextResponse.json({
    banned: true,
    reason: ban.reason,
    expiresAt: ban.expiresAt,
  })
}
