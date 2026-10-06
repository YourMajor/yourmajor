import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { safeOrigin } from '@/lib/app-url'
import { createPortalSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const origin = safeOrigin(request.headers.get('origin'))

  try {
    const session = await createPortalSession(user.id, `${origin}/billing`)
    return NextResponse.json({ url: session.url })
  } catch (err) {
    // Only the missing-customer case is a 404. Catching everything as one
    // flattened a Stripe outage into "No billing account found", which sends
    // the user off to create a second subscription they already have.
    if (err instanceof Error && err.message === 'No Stripe customer found') {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }
    console.error('[billing/portal] stripe session failed:', err)
    return NextResponse.json({ error: 'Could not open billing. Please try again.' }, { status: 502 })
  }
}
