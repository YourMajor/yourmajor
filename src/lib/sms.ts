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

import twilio from 'twilio'

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
}

/**
 * Send a single SMS message. No-ops if Twilio is not configured or `to` is empty.
 */
export async function sendSMS(to: string, body: string): Promise<void> {
  if (!to) return
  const client = getClient()
  if (!client) return

  const from = process.env.TWILIO_PHONE_NUMBER
  if (!from) return

  try {
    await client.messages.create({ to, from, body })
  } catch (err) {
    console.error('[sms] Failed to send SMS:', err instanceof Error ? err.message : err)
  }
}

/**
 * Send SMS to many recipients. Skips recipients with no phone number.
 */
export async function sendSMSToMany(
  recipients: Array<{ phone: string | null | undefined }>,
  bodyFn: (recipient: { phone: string }) => string
): Promise<void> {
  const client = getClient()
  if (!client) return

  const from = process.env.TWILIO_PHONE_NUMBER
  if (!from) return

  const withPhone = recipients.filter(
    (r): r is { phone: string } => !!r.phone
  )

  await Promise.allSettled(
    withPhone.map((r) =>
      client.messages.create({ to: r.phone, from, body: bodyFn(r) }).catch((err) => {
        console.error(`[sms] Failed to send to ${r.phone}:`, err instanceof Error ? err.message : err)
      })
    )
  )
}
