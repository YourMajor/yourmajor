import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import Stripe from 'stripe'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function createPrismaClient() {
  const url = new URL(process.env.DATABASE_URL!)
  url.searchParams.delete('sslmode')
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  })
  return new PrismaClient({ adapter })
}

const prisma = createPrismaClient()

async function main() {
  const command = process.argv[2]

  // Get a test user
  const users = await prisma.user.findMany({
    take: 3,
    select: { id: true, email: true, stripeCustomerId: true },
  })
  console.log('\n=== Available Users ===')
  console.log(JSON.stringify(users, null, 2))

  if (!users.length) {
    console.error('No users found in database!')
    return
  }

  const user = users[0]
  console.log(`\nUsing user: ${user.email} (${user.id})`)

  if (command === 'checkout-pro') {
    await testCheckout('PRO', user)
  } else if (command === 'checkout-club') {
    await testCheckout('CLUB', user)
  } else if (command === 'checkout-league') {
    await testCheckout('LEAGUE', user)
  } else if (command === 'checkout-all') {
    await testCheckout('PRO', user)
    await testCheckout('CLUB', user)
    await testCheckout('LEAGUE', user)
  } else if (command === 'verify') {
    await verifyPurchases(user.id)
  } else if (command === 'list-sessions') {
    await listRecentSessions()
  } else {
    console.log(`
Usage:
  npx tsx scripts/test-stripe.ts checkout-pro     - Create Pro checkout session ($29)
  npx tsx scripts/test-stripe.ts checkout-club    - Create Club checkout session ($99/mo)
  npx tsx scripts/test-stripe.ts checkout-league  - Create League/Tour checkout session ($1,499)
  npx tsx scripts/test-stripe.ts checkout-all     - Create all three checkout sessions
  npx tsx scripts/test-stripe.ts verify           - Verify Purchase records in DB
  npx tsx scripts/test-stripe.ts list-sessions    - List recent Stripe checkout sessions
`)
  }

  await prisma.$disconnect()
}

async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })

  if (user?.stripeCustomerId) return user.stripeCustomerId

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}

async function testCheckout(
  type: 'PRO' | 'CLUB' | 'LEAGUE',
  user: { id: string; email: string }
) {
  console.log(`\n=== Creating ${type} Checkout Session ===`)

  const customerId = await getOrCreateCustomer(user.id, user.email)
  console.log(`Stripe Customer ID: ${customerId}`)

  const configs = {
    PRO: {
      mode: 'payment' as const,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 2900,
            product_data: {
              name: 'YourMajor Pro — Tournament Credit',
              description:
                'Unlock up to 72 players, multi-round, powerups, and custom branding.',
            },
          },
          quantity: 1,
        },
      ],
      metadata: { userId: user.id, purchaseType: 'EVENT' },
    },
    CLUB: {
      mode: 'subscription' as const,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 9900,
            recurring: { interval: 'month' as const },
            product_data: {
              name: 'YourMajor Club — Monthly',
              description:
                'Up to 4 tournaments per month with all Pro features. Cancel anytime.',
            },
          },
          quantity: 1,
        },
      ],
      metadata: { userId: user.id, purchaseType: 'CLUB' },
      subscription_data: {
        metadata: { userId: user.id, purchaseType: 'CLUB' },
      },
    },
    LEAGUE: {
      mode: 'payment' as const,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 149900,
            product_data: {
              name: 'YourMajor Tour — Annual Pass',
              description: 'Unlimited tournaments and all features for 365 days.',
            },
          },
          quantity: 1,
        },
      ],
      metadata: { userId: user.id, purchaseType: 'LEAGUE' },
    },
  }

  const config = configs[type]

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    ...config,
    success_url: 'http://localhost:3000/dashboard?purchased=' + type.toLowerCase(),
    cancel_url: 'http://localhost:3000/pricing',
  })

  console.log(`\n  Session ID: ${session.id}`)
  console.log(`  Amount: $${type === 'PRO' ? '29' : type === 'CLUB' ? '99/mo' : '1,499'}`)
  console.log(`  Mode: ${session.mode}`)
  console.log(`\n  >>> OPEN THIS URL IN YOUR BROWSER TO PAY: <<<`)
  console.log(`  ${session.url}`)
  console.log(`\n  Test Card: 4242 4242 4242 4242`)
  console.log(`  Expiry: 12/34  CVC: 123`)
  console.log(`  Name/Email/Address: any values\n`)
}

async function verifyPurchases(userId: string) {
  console.log('\n=== Purchase Records in Database ===')
  const purchases = await prisma.purchase.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  if (!purchases.length) {
    console.log('No purchases found for this user.')
    console.log(
      'Note: Purchases are created by the webhook handler. Make sure webhook forwarding is active.'
    )
    return
  }

  for (const p of purchases) {
    console.log(`\n  ID: ${p.id}`)
    console.log(`  Type: ${p.type}`)
    console.log(`  Status: ${p.status}`)
    console.log(`  Amount: $${(p.amount / 100).toFixed(2)}`)
    console.log(`  Stripe Session: ${p.stripeSessionId ?? 'N/A'}`)
    console.log(`  Stripe Sub ID: ${p.stripeSubId ?? 'N/A'}`)
    console.log(`  Tournament: ${p.tournamentId ?? 'N/A (credit)'}`)
    console.log(`  Expires: ${p.expiresAt ?? 'N/A'}`)
    console.log(`  Created: ${p.createdAt}`)
  }
}

async function listRecentSessions() {
  console.log('\n=== Recent Stripe Checkout Sessions ===')
  const sessions = await stripe.checkout.sessions.list({ limit: 5 })

  for (const s of sessions.data) {
    console.log(`\n  ID: ${s.id}`)
    console.log(`  Status: ${s.status}`)
    console.log(`  Mode: ${s.mode}`)
    console.log(`  Payment Status: ${s.payment_status}`)
    console.log(`  Amount: $${((s.amount_total ?? 0) / 100).toFixed(2)}`)
    console.log(`  Customer: ${s.customer}`)
    console.log(`  Metadata: ${JSON.stringify(s.metadata)}`)
    console.log(`  Created: ${new Date((s.created ?? 0) * 1000).toISOString()}`)
  }
}

main().catch(console.error)
