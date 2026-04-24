import type { Resend } from 'resend'

let resend: Resend | null = null
const from = process.env.EMAIL_FROM ?? 'noreply@resend.dev'
const domain = process.env.NEXT_PUBLIC_APP_URL || 'https://turfwar.app'

async function getResend(): Promise<Resend | null> {
  if (resend) return resend
  if (!process.env.RESEND_API_KEY) return null
  const { Resend: ResendClass } = await import('resend')
  resend = new ResendClass(process.env.RESEND_API_KEY)
  return resend
}

/**
 * Send an email. No-ops silently if RESEND_API_KEY is not configured.
 */
export async function sendEmail(to: string, subject: string, html: string) {
  const resend = await getResend()
  if (!resend) return
  try {
    await resend.emails.send({ from, to, subject, html })
  } catch (e) {
    console.error(`[sendEmail] failed to ${to}:`, e)
  }
}

/**
 * Send the same email to multiple recipients (individual sends, not CC).
 */
export async function sendEmailToMany(
  recipients: { email: string; name?: string }[],
  subject: string,
  htmlFn: (recipient: { email: string; name?: string }) => string,
) {
  const resend = await getResend()
  if (!resend) return
  await Promise.allSettled(
    recipients.map((r) =>
      resend.emails.send({ from, to: r.email, subject, html: htmlFn(r) }).catch((e) => {
        console.error(`[sendEmailToMany] failed to ${r.email}:`, e)
      }),
    ),
  )
}

export { domain }
