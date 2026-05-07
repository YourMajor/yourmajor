import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { executePick } from '@/lib/draft-pick'
import { sendPushToUser } from '@/lib/push'
import { broadcastDraftPick } from '@/lib/draft-broadcast'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params
  const { powerupId } = (await req.json()) as { powerupId: string }

  if (!powerupId) {
    return NextResponse.json({ error: 'powerupId is required' }, { status: 400 })
  }

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a tournament participant' }, { status: 403 })

  const draft = await prisma.draft.findUnique({
    where: { tournamentId },
    select: { id: true, currentPick: true },
  })
  if (!draft) return NextResponse.json({ error: 'No draft found.' }, { status: 404 })

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { slug: true, name: true },
  })
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  try {
    const result = await prisma.$transaction(async (tx) => {
      return executePick(tx, {
        draftId: draft.id,
        tournamentPlayerId: player.id,
        powerupId,
        expectedCurrentPick: draft.currentPick,
      })
    })

    void broadcastDraftPick(draft.id)

    if (result.nextPickerUserId) {
      void sendPushToUser(result.nextPickerUserId, {
        title: `${tournament.name} — You're on the clock`,
        body: "It's your turn to pick a powerup.",
        url: `/${tournament.slug}/draft`,
      }).catch((err) => console.error('[push] draft pick dispatch failed', err))
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    // Prisma unique-violation on (draftId, pickNumber) — race loser
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Pick already recorded for this turn.' },
        { status: 409 },
      )
    }
    const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
