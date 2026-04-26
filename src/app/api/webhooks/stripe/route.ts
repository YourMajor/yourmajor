import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const { default: StripeSDK } = await import('stripe')
    const stripe = new StripeSDK(process.env.STRIPE_SECRET_KEY!)
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe-webhook] Signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { userId, tournamentId, purchaseType } = session.metadata ?? {}

        if (!userId || !purchaseType) break

        // Idempotency: stripeSessionId is @unique in schema. Stripe retries
        // webhooks on any non-2xx or timeout, so dedupe by session.id and
        // ack with 200 instead of letting the unique constraint throw.
        const existing = await prisma.purchase.findUnique({
          where: { stripeSessionId: session.id },
          select: { id: true },
        })
        if (existing) break

        if (purchaseType === 'EVENT') {
          // tournamentId may be null for "credit" purchases from the pricing page
          await prisma.purchase.create({
            data: {
              userId,
              ...(tournamentId ? { tournamentId } : {}),
              type: 'EVENT',
              status: 'ACTIVE',
              stripeSessionId: session.id,
              amount: session.amount_total ?? 2900,
            },
          })
        } else if (purchaseType === 'CLUB') {
          // Club is a recurring subscription — store the subscription ID
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id
          await prisma.purchase.create({
            data: {
              userId,
              type: 'CLUB',
              status: 'ACTIVE',
              stripeSessionId: session.id,
              stripeSubId: subId ?? null,
              amount: session.amount_total ?? 9900,
            },
          })
        } else if (purchaseType === 'LEAGUE') {
          await prisma.purchase.create({
            data: {
              userId,
              type: 'LEAGUE',
              status: 'ACTIVE',
              stripeSessionId: session.id,
              amount: session.amount_total ?? 199900,
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 365 days
            },
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const purchase = await prisma.purchase.findUnique({
          where: { stripeSubId: sub.id },
        })
        if (purchase) {
          const newStatus = (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') ? 'ACTIVE' : 'EXPIRED'
          await prisma.purchase.update({
            where: { id: purchase.id },
            data: { status: newStatus },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await prisma.purchase.updateMany({
          where: { stripeSubId: sub.id },
          data: { status: 'CANCELLED' },
        })
        break
      }
    }
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err)
    return NextResponse.json(
      { error: 'Webhook handler failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
