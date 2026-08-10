import webpush, { WebPushError } from 'web-push'
import { prisma } from '@/lib/prisma'

let configured = false

function configureVapid(): boolean {
  if (configured) return true
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  icon?: string
}

// Delivery to every subscription belonging to the given users, in one query.
// Prunes 404/410 endpoints so stale subscriptions don't accumulate.
//
// Callers must schedule this with `after()` — on Vercel the function can be
// frozen the moment the response is sent, so a bare `void` here never runs.
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!configureVapid() || userIds.length === 0) return

  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } })
  if (subs.length === 0) return

  const json = JSON.stringify(payload)
  const stale: string[] = []

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        )
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          stale.push(s.endpoint)
        } else {
          console.error('[push] sendNotification failed', err)
        }
      }
    }),
  )

  if (stale.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } })
  }
}

export const sendPushToUser = (userId: string, payload: PushPayload): Promise<void> =>
  sendPushToUsers([userId], payload)
