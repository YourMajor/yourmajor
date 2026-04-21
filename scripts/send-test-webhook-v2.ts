import * as crypto from 'crypto'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Use the REAL user ID that the dev server can see
const REAL_USER_ID = '88e63091-d03e-4347-81d2-75b0f5d40407'

const tests = [
  {
    name: 'EVENT purchase',
    event: {
      id: 'evt_test_event_' + Date.now(),
      object: 'event',
      api_version: '2026-03-25.dahlia',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_event_' + Date.now(),
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          status: 'complete',
          amount_total: 2900,
          subscription: null,
          metadata: {
            userId: REAL_USER_ID,
            purchaseType: 'EVENT',
          },
        },
      },
    },
  },
  {
    name: 'CLUB subscription',
    event: {
      id: 'evt_test_club_' + Date.now(),
      object: 'event',
      api_version: '2026-03-25.dahlia',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_club_' + Date.now(),
          object: 'checkout.session',
          mode: 'subscription',
          payment_status: 'paid',
          status: 'complete',
          amount_total: 9900,
          subscription: 'sub_test_club_' + Date.now(),
          metadata: {
            userId: REAL_USER_ID,
            purchaseType: 'CLUB',
          },
        },
      },
    },
  },
  {
    name: 'LEAGUE purchase',
    event: {
      id: 'evt_test_league_' + Date.now(),
      object: 'event',
      api_version: '2026-03-25.dahlia',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_league_' + Date.now(),
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          status: 'complete',
          amount_total: 149900,
          subscription: null,
          metadata: {
            userId: REAL_USER_ID,
            purchaseType: 'LEAGUE',
          },
        },
      },
    },
  },
]

async function sendWebhook(name: string, event: object) {
  const payload = JSON.stringify(event)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  const sigHeader = `t=${timestamp},v1=${signature}`

  const res = await fetch('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': sigHeader,
    },
    body: payload,
  })

  const text = await res.text()
  console.log(`[${name}] Status: ${res.status} - ${text}`)
  return res.status
}

async function main() {
  console.log(`Testing with real user ID: ${REAL_USER_ID}\n`)

  for (const test of tests) {
    await sendWebhook(test.name, test.event)
  }
}

main().catch(console.error)
