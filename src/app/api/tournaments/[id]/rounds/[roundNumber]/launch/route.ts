import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser, isTournamentAdmin } from '@/lib/auth'

/**
 * Launch a round for scoring now, ahead of its automatic opening
 * (3 hours before the first tee time). Idempotent: launching an open round
 * keeps its original openedAt.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; roundNumber: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tournamentId, roundNumber: raw } = await params

  if (!(await isTournamentAdmin(user.id, tournamentId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const roundNumber = Number.parseInt(raw, 10)
  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    return NextResponse.json({ error: 'Invalid round' }, { status: 400 })
  }

  const round = await prisma.tournamentRound.findUnique({
    where: { tournamentId_roundNumber: { tournamentId, roundNumber } },
    select: { id: true, openedAt: true, tournament: { select: { slug: true, status: true } } },
  })
  if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 })
  if (round.tournament.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'The tournament has to be live before a round can be launched.' }, { status: 400 })
  }

  if (!round.openedAt) {
    // Conditional so two admins launching at once post one message.
    const claimed = await prisma.tournamentRound.updateMany({
      where: { id: round.id, openedAt: null },
      data: { openedAt: new Date() },
    })
    if (claimed.count === 1) {
      await prisma.tournamentMessage.create({
        data: {
          tournamentId,
          userId: user.id,
          content: `⛳ Round ${roundNumber} is open for scoring.`,
          isSystem: true,
        },
      })
    }
  }

  revalidatePath(`/${round.tournament.slug}/admin`)
  revalidatePath(`/${round.tournament.slug}/play`)
  return NextResponse.json({ ok: true, roundNumber })
}
