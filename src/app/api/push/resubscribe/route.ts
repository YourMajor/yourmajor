import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// Service worker `pushsubscriptionchange` handler hits this when the browser
// rotates a push subscription. We can't rely on session cookies here (the SW
// fetch may run while the page is closed and tokens may be expired), so the
// `oldEndpoint` itself acts as the credential — only the device that owns
// that subscription URL knows it. We look up the existing row and rewrite it
// with the new endpoint/keys, preserving the userId. If the old endpoint
// isn't in the DB (already pruned by 410-cleanup), we silently succeed —
// client-side reconciliation in PushNotificationManager will resubscribe
// next time the user opens the app.

const schema = z.object({
  oldEndpoint: z.string().url().max(2048),
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
  userAgent: z.string().max(512).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  const { oldEndpoint, endpoint, p256dh, auth, userAgent } = parsed.data

  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint: oldEndpoint },
  })
  if (!existing) {
    return NextResponse.json({ ok: true, rotated: false })
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: existing.userId,
      endpoint,
      p256dh,
      auth,
      userAgent: userAgent ?? existing.userAgent,
    },
    update: {
      userId: existing.userId,
      p256dh,
      auth,
      userAgent: userAgent ?? existing.userAgent,
    },
  })

  if (oldEndpoint !== endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: oldEndpoint } })
  }

  return NextResponse.json({ ok: true, rotated: true })
}
