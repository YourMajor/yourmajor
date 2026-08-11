import type { Resend } from 'resend'
import { getAppUrl } from '@/lib/app-url'

let resend: Resend | null = null
const from = process.env.EMAIL_FROM ?? 'noreply@resend.dev'
const domain = getAppUrl()

async function getResend(): Promise<Resend | null> {
  if (resend) return resend
  if (!process.env.RESEND_API_KEY) return null
  const { Resend: ResendClass } = await import('resend')
  resend = new ResendClass(process.env.RESEND_API_KEY)
  return resend
}

/**
 * Escape a value for interpolation into email HTML.
 *
 * Email bodies are built with template literals, so any user-controlled string
 * dropped into one is an injection point — a tournament name is chosen by
 * whoever created the tournament and then rendered in every invitee's inbox.
 * Escaping quotes as well as angle brackets matters because several of these
 * values also land inside href="..." attributes.
 *
 * Mail clients vary in how much HTML they execute, which limits the blast
 * radius but does not make unescaped interpolation safe.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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
