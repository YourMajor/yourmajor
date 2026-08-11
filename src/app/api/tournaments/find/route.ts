import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { checkRateLimit, clientIp, rateLimitedResponse, LIMITS } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  // The join code IS the credential here — this route is unauthenticated and a
  // hit reveals a tournament and enrolls the caller as a watcher. Six
  // characters over a 32-char alphabet is only ~10^9, so without a limit the
  // whole space is walkable. Rate-limited after the presence check so a
  // malformed request doesn't consume budget.
  const ip = clientIp(request.headers)
  const limit = await checkRateLimit(`find:${ip}`, LIMITS.joinCodeLookup)
  if (!limit.ok) return rateLimitedResponse(limit.retryAfter)

  const tournament = await prisma.tournament.findUnique({
    where: { joinCode: code },
    select: {
      id: true,
      slug: true,
      name: true,
      tournamentType: true,
      status: true,
    },
  })

  if (!tournament || tournament.tournamentType === 'INVITE') {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  }

  // If signed in, remember this lookup so the tournament shows up on
  // "Your Tournaments" under Watching. Existing membership rows (registered
  // players, admins) are left untouched — the empty `update` means an existing
  // row keeps its current isParticipant/isAdmin/isWatching values.
  const user = await getUser()
  if (user) {
    await prisma.tournamentPlayer.upsert({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
      create: {
        tournamentId: tournament.id,
        userId: user.id,
        isParticipant: false,
        isAdmin: false,
        isWatching: true,
      },
      update: {},
    })
  }

  return NextResponse.json({ slug: tournament.slug, name: tournament.name, status: tournament.status })
}
