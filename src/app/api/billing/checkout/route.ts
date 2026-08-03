import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { createProCheckoutSession, createClubCheckoutSession, createLeagueCheckoutSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, tournamentId, tournamentName, slug } = body

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  // Stripe is an external call — an outage here would otherwise surface as an
  // unhandled 500 with a raw stack. Mirrors billing/portal.
  try {
    if (type === 'PRO') {
      const returnUrl = slug && tournamentId ? `${origin}/${slug}` : `${origin}/pricing`
      const session = await createProCheckoutSession({
        userId: user.id,
        email: user.email,
        ...(tournamentId ? { tournamentId, tournamentName } : {}),
        returnUrl,
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
  } catch (err) {
    console.error('[billing/checkout] stripe session failed:', err)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
