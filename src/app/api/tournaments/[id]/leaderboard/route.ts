import { NextRequest, NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/scoring'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // This route used to be fully anonymous, which exposed standings and player
  // names for any tournament id including private ones. Anonymous spectating
  // is a real feature, so gate on visibility rather than requiring auth
  // outright: INVITE is the codebase's notion of private (see
  // tournaments/find, which excludes exactly that type from join-code lookup).
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { tournamentType: true },
  })
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  if (tournament.tournamentType === 'INVITE') {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
      select: { id: true },
    })
    if (!membership && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const roundId = request.nextUrl.searchParams.get('roundId') ?? undefined
  const standings = await getLeaderboard(id, roundId)
  return NextResponse.json(standings)
}
