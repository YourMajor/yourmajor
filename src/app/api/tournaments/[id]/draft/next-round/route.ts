import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser, isTournamentAdmin } from '@/lib/auth'
import { canOpenNextRoundDraft } from '@/lib/draft-utils'
import { sendEmailToMany, domain, escapeHtml } from '@/lib/email'

/**
 * Open the powerup draft for the next tournament round.
 *
 * Moves the tournament's draft from a COMPLETED round-N draft to a PENDING
 * round-N+1 draft. The admin then sets the order and starts it through the
 * normal /order and /start endpoints. Cards players didn't use in earlier
 * rounds stay in their hands; this round's pool is the full tournament pool
 * again.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId } = await params

  if (!(await isTournamentAdmin(user.id, tournamentId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [draft, tournament] = await Promise.all([
    prisma.draft.findUnique({ where: { tournamentId } }),
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        name: true,
        slug: true,
        rounds: { select: { roundNumber: true } },
      },
    }),
  ])
  if (!draft) return NextResponse.json({ error: 'No draft found' }, { status: 404 })
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  const check = canOpenNextRoundDraft(
    draft,
    tournament.rounds.map((r) => r.roundNumber),
  )
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: 400 })
  }

  // Conditional on the state we just validated, so a double-click (or two
  // admins) can't skip a round.
  const updated = await prisma.draft.updateMany({
    where: { id: draft.id, status: 'COMPLETED', currentRound: draft.currentRound },
    data: {
      currentRound: check.nextRound,
      status: 'PENDING',
      currentPick: 0,
      turnStartedAt: null,
    },
  })
  if (updated.count !== 1) {
    return NextResponse.json(
      { error: 'The draft changed while opening the next round. Refresh and try again.' },
      { status: 409 },
    )
  }

  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, isParticipant: true },
    select: { id: true, user: { select: { email: true, name: true } } },
  })

  await prisma.notification.createMany({
    data: players.map((p) => ({
      tournamentPlayerId: p.id,
      type: 'DRAFT_STARTED' as const,
      payload: {
        tournamentRound: check.nextRound,
        message: `The Round ${check.nextRound} powerup draft is being set up.`,
      },
    })),
  })

  after(async () => {
    try {
      await sendEmailToMany(
        players.map((p) => ({ email: p.user.email, name: p.user.name ?? undefined })),
        `Round ${check.nextRound} draft — ${tournament.name}`,
        () =>
          `<h2>${escapeHtml(tournament.name)}</h2>
          <p>The Round ${check.nextRound} powerup draft is being set up. Any cards you didn't play last round are still in your hand.</p>
          <p><a href="${domain}/${escapeHtml(tournament.slug)}/draft">View Draft</a></p>`,
      )
    } catch (err) {
      console.error('[draft/next-round] email dispatch failed', err)
    }
  })

  return NextResponse.json({ status: 'PENDING', currentRound: check.nextRound })
}
