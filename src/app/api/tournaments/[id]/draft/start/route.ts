import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { computeCurrentTurn } from '@/lib/draft-utils'
import { sendEmailToMany, domain } from '@/lib/email'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params

  // Verify admin
  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { isAdmin: true },
  })
  if (!membership?.isAdmin && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const draft = await prisma.draft.findUnique({ where: { tournamentId } })
  if (!draft) return NextResponse.json({ error: 'No draft found' }, { status: 404 })
  if (draft.status !== 'PENDING') {
    return NextResponse.json({ error: 'Draft has already started' }, { status: 400 })
  }

  const draftOrder = draft.draftOrder as string[] | null
  if (!draftOrder || draftOrder.length === 0) {
    return NextResponse.json({ error: 'Draft order must be set before starting' }, { status: 400 })
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { powerupsPerPlayer: true },
  })

  // Start the draft
  const updated = await prisma.draft.update({
    where: { tournamentId },
    data: { status: 'ACTIVE' },
  })

  // Notify the first player
  const firstTurn = computeCurrentTurn(
    draftOrder,
    draft.format,
    0,
    tournament?.powerupsPerPlayer ?? 3,
  )
  if (firstTurn) {
    await prisma.notification.create({
      data: {
        tournamentPlayerId: firstTurn.tournamentPlayerId,
        type: 'DRAFT_YOUR_TURN',
        payload: { pickNumber: 1, message: "It's your turn to pick a powerup!" },
      },
    })
  }

  // Notify all players that draft has started
  const allPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    select: { id: true, user: { select: { email: true, name: true } } },
  })
  await prisma.notification.createMany({
    data: allPlayers.map((p) => ({
      tournamentPlayerId: p.id,
      type: 'DRAFT_STARTED' as const,
      payload: { message: 'The powerup draft has started!' },
    })),
  })

  // Fetch tournament for email context
  const tournamentInfo = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true, slug: true },
  })

  // Email all players that draft started
  await sendEmailToMany(
    allPlayers.map((p) => ({ email: p.user.email, name: p.user.name ?? undefined })),
    `Draft started — ${tournamentInfo?.name ?? 'Tournament'}`,
    () =>
      `<h2>${tournamentInfo?.name ?? 'Tournament'}</h2>
      <p>The powerup draft has started! Keep an eye out for your turn.</p>
      <p><a href="${domain}/${tournamentInfo?.slug}/draft">View Draft</a></p>`,
  )

  return NextResponse.json({ status: updated.status })
}
