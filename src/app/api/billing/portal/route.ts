import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { createPortalSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  try {
    const session = await createPortalSession(user.id, `${origin}/billing`)
    return NextResponse.json({ url: session.url })
  } catch {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }
}
