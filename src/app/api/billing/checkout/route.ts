import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { createProCheckoutSession, createClubCheckoutSession, createLeagueCheckoutSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, tournamentId, tournamentName } = body

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  if (type === 'PRO') {
    const session = await createProCheckoutSession({
      userId: user.id,
      email: user.email,
      ...(tournamentId ? { tournamentId, tournamentName } : {}),
      returnUrl: `${origin}/pricing`,
    })
    return NextResponse.json({ url: session.url })
  }

  if (type === 'CLUB') {
    const session = await createClubCheckoutSession({
      userId: user.id,
      email: user.email,
      returnUrl: `${origin}/pricing`,
    })
    return NextResponse.json({ url: session.url })
  }

  if (type === 'LEAGUE') {
    const session = await createLeagueCheckoutSession({
      userId: user.id,
      email: user.email,
      returnUrl: `${origin}/pricing`,
    })
    return NextResponse.json({ url: session.url })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
