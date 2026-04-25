// Shared invite delivery: email (Resend) + SMS (Twilio).
// Three call sites: createTournamentFromWizard, sendLateInvites, importRosterCsv.

import { sendSMS } from '@/lib/sms'

export interface InvitationToSend {
  email?: string | null
  phone?: string | null
  token: string
}

interface SendInvitationsOptions {
  tournamentName: string
  slug: string
  invitations: InvitationToSend[]
}

function inviteEmailHtml(tournamentName: string, slug: string, token: string, domain: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;max-width:600px;">
        <tr><td style="padding:40px 30px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#333333;">
          <p style="margin:0 0 20px;">You have been invited to join <strong>${tournamentName}</strong>.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
            <tr><td align="center" style="background:#006747;border-radius:4px;">
              <a href="${domain}/${slug}/register?token=${token}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;">Accept Invitation</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:14px;color:#666666;">Or copy this link: <a href="${domain}/${slug}/register?token=${token}" style="color:#006747;word-break:break-all;">${domain}/${slug}/register?token=${token}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Fan out email + SMS invitations. Best-effort — individual delivery failures
 * are swallowed so one bad address doesn't block the rest.
 */
export async function sendInvitations({ tournamentName, slug, invitations }: SendInvitationsOptions): Promise<void> {
  if (invitations.length === 0) return
  const domain = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  const emails = invitations.filter((i): i is InvitationToSend & { email: string } => Boolean(i.email))
  const phones = invitations.filter((i): i is InvitationToSend & { phone: string } => Boolean(i.phone))

  // Email path
  if (emails.length > 0) {
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const { Resend } = await import('resend')
      const resend = new Resend(resendKey)
      await Promise.all(
        emails.map((inv) =>
          resend.emails
            .send({
              from: process.env.EMAIL_FROM ?? 'noreply@yourdomain.com',
              to: inv.email,
              subject: `You're invited to ${tournamentName}`,
              html: inviteEmailHtml(tournamentName, slug, inv.token, domain),
            })
            .catch(() => {}),
        ),
      )
    }
  }

  // SMS path
  for (const inv of phones) {
    await sendSMS(
      inv.phone,
      `You're invited to ${tournamentName}! Join here: ${domain}/${slug}/register?token=${inv.token}`,
    ).catch(() => {})
  }
}

/**
 * Backwards-compatible thin wrapper for callers that only have email invitations.
 * Existing imports of `sendInviteEmails` from `actions.ts` re-export this.
 */
export async function sendInviteEmails(
  tournamentName: string,
  slug: string,
  invitations: Array<{ email: string; token: string }>,
): Promise<void> {
  await sendInvitations({
    tournamentName,
    slug,
    invitations: invitations.map((i) => ({ email: i.email, token: i.token })),
  })
}
