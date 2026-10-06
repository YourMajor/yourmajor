import { NextRequest, NextResponse } from 'next/server'
import { parseBody } from '@/lib/parse-body'
import { z } from 'zod'
import { getUser, isTournamentAdmin } from '@/lib/auth'
import { safeOrigin } from '@/lib/app-url'
import { createProCheckoutSession, createClubCheckoutSession, createLeagueCheckoutSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(request, z.object({
    type: z.string().min(1),
    tournamentId: z.string().min(1).optional(),
    tournamentName: z.string().max(200).optional(),
    slug: z.string().max(200).optional(),
  }))
  if (!parsed.ok) return parsed.response
  const { type, tournamentId, tournamentName, slug } = parsed.data

  // A Purchase stamped onto a tournament is a durable tier grant, so the payer
  // has to be that tournament's admin. Without this any signed-in user can pay
  // against an event they don't run and upgrade someone else's tournament.
  if (tournamentId && !(await isTournamentAdmin(user.id, tournamentId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const origin = safeOrigin(request.headers.get('origin'))

  // Stripe is an external call — an outage here would otherwise surface as an
  // unhandled 500 with a raw stack. Mirrors billing/portal.
  try {
    if (type === 'PRO') {
      // encodeURIComponent because `slug` is only shape-checked for length —
      // a raw value can otherwise inject extra path segments into the URL
      // Stripe redirects to on success.
      const returnUrl =
        slug && tournamentId ? `${origin}/${encodeURIComponent(slug)}` : `${origin}/pricing`
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
