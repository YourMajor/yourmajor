import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import type { PricingTier } from '@/generated/prisma/client'

async function getStripe(): Promise<Stripe> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  const { default: StripeSDK } = await import('stripe')
  return new StripeSDK(process.env.STRIPE_SECRET_KEY)
}

let _stripe: Stripe | undefined
async function resolveStripe(): Promise<Stripe> {
  _stripe ??= await getStripe()
  return _stripe
}

/**
 * Get or create a Stripe customer for a given user.
 */
async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })

  if (user?.stripeCustomerId) return user.stripeCustomerId

  const customer = await (await resolveStripe()).customers.create({
    email,
    metadata: { userId },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}

/**
 * Create a Stripe Checkout session for a Pro (one-time event) purchase.
 * When tournamentId/tournamentName are omitted, this creates a generic
 * "tournament credit" that can be consumed later during tournament creation.
 */
export async function createProCheckoutSession(opts: {
  userId: string
  email: string
  tournamentId?: string
  tournamentName?: string
  returnUrl: string
}) {
  const customerId = await getOrCreateCustomer(opts.userId, opts.email)

  return (await resolveStripe()).checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: 2900,
          product_data: {
            name: opts.tournamentName
              ? `YourMajor Pro — ${opts.tournamentName}`
              : 'YourMajor Pro — Tournament Credit',
            description: 'Unlock up to 72 players, multi-round, powerups, and custom branding.',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: opts.userId,
      ...(opts.tournamentId ? { tournamentId: opts.tournamentId } : {}),
      purchaseType: 'EVENT',
    },
    success_url: opts.tournamentId
      ? `${opts.returnUrl}?upgraded=true`
      : `${opts.returnUrl.replace(/\/tournaments\/new$/, '/dashboard')}?purchased=pro`,
    cancel_url: opts.returnUrl,
  })
}

/**
 * Create a Stripe Checkout session for the Club tier ($99/month subscription).
 */
export async function createClubCheckoutSession(opts: {
  userId: string
  email: string
  returnUrl: string
}) {
  const customerId = await getOrCreateCustomer(opts.userId, opts.email)

  return (await resolveStripe()).checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: 9900,
          recurring: { interval: 'month' },
          product_data: {
            name: 'YourMajor Club — Monthly',
            description: 'Up to 4 tournaments per month with all Pro features. Cancel anytime.',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: opts.userId,
      purchaseType: 'CLUB',
    },
    subscription_data: {
      metadata: {
        userId: opts.userId,
        purchaseType: 'CLUB',
      },
    },
    success_url: `${opts.returnUrl.replace(/\/pricing$/, '/dashboard')}?purchased=club`,
    cancel_url: opts.returnUrl,
  })
}

/**
 * Create a Stripe Checkout session for a Tour annual pass ($1,999, one-time).
 */
export async function createLeagueCheckoutSession(opts: {
  userId: string
  email: string
  returnUrl: string
}) {
  const customerId = await getOrCreateCustomer(opts.userId, opts.email)

  return (await resolveStripe()).checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: 199900,
          product_data: {
            name: 'YourMajor Tour — Annual Pass',
            description:
              'Unlimited tournaments, 144 players per event, 5 admin seats, custom subdomain, sponsor placements, and season-over-season analytics for 365 days.',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: opts.userId,
      purchaseType: 'LEAGUE',
    },
    success_url: `${opts.returnUrl.replace(/\/pricing$/, '/dashboard')}?purchased=tour`,
    cancel_url: opts.returnUrl,
  })
}

/**
 * Determine the effective pricing tier for a tournament.
 */
export async function getTournamentTier(tournamentId: string): Promise<PricingTier> {
  // Check for a direct Pro purchase on this tournament
  const eventPurchase = await prisma.purchase.findUnique({
    where: { tournamentId },
    select: { status: true },
  })
  if (eventPurchase?.status === 'ACTIVE') return 'PRO'

  // Check if the tournament organizer has an active League or Club purchase
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      players: {
        where: { isAdmin: true },
        take: 1,
        select: { userId: true },
      },
    },
  })

  const adminUserId = tournament?.players[0]?.userId
  if (adminUserId) {
    const leaguePurchase = await prisma.purchase.findFirst({
      where: {
        userId: adminUserId,
        type: 'LEAGUE',
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    })
    if (leaguePurchase) return 'LEAGUE'

    const clubPurchase = await prisma.purchase.findFirst({
      where: {
        userId: adminUserId,
        type: 'CLUB',
        status: 'ACTIVE',
      },
    })
    if (clubPurchase) return 'CLUB'
  }

  return 'FREE'
}

/**
 * Check if a user has an active League subscription.
 */
export async function hasActiveLeague(userId: string): Promise<boolean> {
  const purchase = await prisma.purchase.findFirst({
    where: {
      userId,
      type: 'LEAGUE',
      status: 'ACTIVE',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  })
  return !!purchase
}

/**
 * Check if a user has an active Club subscription.
 */
export async function hasActiveClub(userId: string): Promise<boolean> {
  const purchase = await prisma.purchase.findFirst({
    where: {
      userId,
      type: 'CLUB',
      status: 'ACTIVE',
    },
  })
  return !!purchase
}

/**
 * Create a Stripe Customer Portal session for managing subscriptions.
 */
export async function createPortalSession(userId: string, returnUrl: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId) {
    throw new Error('No Stripe customer found')
  }

  return (await resolveStripe()).billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  })
}

/**
 * Count unused Pro tournament credits for a user.
 * An unused credit is an EVENT purchase with no tournamentId attached.
 */
export async function getUnusedProCredits(userId: string): Promise<number> {
  return prisma.purchase.count({
    where: {
      userId,
      type: 'EVENT',
      status: 'ACTIVE',
      tournamentId: null,
    },
  })
}

/**
 * Determine the user's effective tier, expiry, and available pro credits.
 */
export async function getUserTier(userId: string): Promise<{
  tier: PricingTier
  expiresAt: Date | null
  proCredits: number
}> {
  // Check for active League/Tour subscription first
  const leaguePurchase = await prisma.purchase.findFirst({
    where: {
      userId,
      type: 'LEAGUE',
      status: 'ACTIVE',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: { expiresAt: true },
  })

  const proCredits = await getUnusedProCredits(userId)

  if (leaguePurchase) {
    return { tier: 'LEAGUE', expiresAt: leaguePurchase.expiresAt, proCredits }
  }

  // Check for active Club subscription
  const clubPurchase = await prisma.purchase.findFirst({
    where: {
      userId,
      type: 'CLUB',
      status: 'ACTIVE',
    },
    select: { id: true },
  })

  if (clubPurchase) {
    return { tier: 'CLUB', expiresAt: null, proCredits }
  }

  if (proCredits > 0) {
    return { tier: 'PRO', expiresAt: null, proCredits }
  }

  return { tier: 'FREE', expiresAt: null, proCredits: 0 }
}

/**
 * Consume the oldest unused Pro credit by attaching it to a tournament.
 * Returns true if a credit was consumed, false if none available.
 *
 * Accepts an optional transaction client so consumption can be atomic
 * with tournament creation.
 */
export async function consumeProCredit(
  userId: string,
  tournamentId: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<boolean> {
  const db = tx ?? prisma

  const credit = await db.purchase.findFirst({
    where: {
      userId,
      type: 'EVENT',
      status: 'ACTIVE',
      tournamentId: null,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (!credit) return false

  await db.purchase.update({
    where: { id: credit.id },
    data: { tournamentId },
  })

  return true
}
