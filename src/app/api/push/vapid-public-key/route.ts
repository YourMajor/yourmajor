import { NextResponse } from 'next/server'

// Public key is safe to expose. The service worker fetches this so it can
// call pushManager.subscribe() during a `pushsubscriptionchange` event,
// where the SW has no access to the page's environment variables.
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
  return new NextResponse(key, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
