import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser, isTournamentAdmin } from '@/lib/auth'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, messageId } = await params

  if (!(await isTournamentAdmin(user.id, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const message = await prisma.tournamentMessage.findUnique({ where: { id: messageId } })
  if (!message || message.tournamentId !== id) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  await prisma.tournamentMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), deletedBy: user.id },
  })

  return NextResponse.json({ success: true })
}
