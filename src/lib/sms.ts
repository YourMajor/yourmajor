/**
 * Twilio SMS client
 *
 * Env vars:
 *   TWILIO_ACCOUNT_SID  — Twilio Account SID
 *   TWILIO_AUTH_TOKEN    — Twilio Auth Token
 *   TWILIO_PHONE_NUMBER  — Twilio "From" phone number (E.164 format, e.g. +15551234567)
 *
 * All functions no-op gracefully if Twilio is not configured.
 */

async function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  const twilio = (await import('twilio')).default
  return twilio(sid, token)
}

/**
 * Send a single SMS message. No-ops if Twilio is not configured or `to` is empty.
 */
export async function sendSMS(to: string, body: string): Promise<void> {
  if (!to) return
  const client = await getClient()
  if (!client) return

  const from = process.env.TWILIO_PHONE_NUMBER
  if (!from) return

  try {
    await client.messages.create({ to, from, body })
  } catch (err) {
    console.error('[sms] Failed to send SMS:', err instanceof Error ? err.message : err)
  }
}
