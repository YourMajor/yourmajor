import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
    select: { id: true, isParticipant: true, isAdmin: true },
  })
  if (!membership) return NextResponse.json({ ok: true })

  // Defence in depth — the UI only surfaces Unwatch on watcher-only cards,
  // but a registered player or admin must not be able to nuke their own
  // membership row through this endpoint.
  if (membership.isParticipant || membership.isAdmin) {
    return NextResponse.json(
      { error: "You're registered for this tournament — unregister instead." },
      { status: 409 }
    )
  }

  await prisma.tournamentPlayer.delete({ where: { id: membership.id } })

  revalidatePath('/tournaments')

  return NextResponse.json({ ok: true })
}
