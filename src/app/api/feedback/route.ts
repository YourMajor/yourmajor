import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'

const feedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  category: z.enum(['bug', 'feature', 'general', 'other']),
  message: z
    .string()
    .min(10, 'Please provide at least 10 characters')
    .max(500, 'Maximum 500 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
})

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  general: 'General Feedback',
  other: 'Other',
}

function buildStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const result = feedbackSchema.safeParse(body)
  if (!result.success) {
    const firstIssue = result.error.issues[0]
    return NextResponse.json(
      { error: firstIssue?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { rating, category, message, email } = result.data

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.error('[feedback] RESEND_API_KEY is not configured')
    return NextResponse.json(
      { error: 'Email service is not configured' },
      { status: 500 }
    )
  }

  const resend = new Resend(resendKey)
  const categoryLabel = CATEGORY_LABELS[category] ?? category
  const stars = buildStars(rating)
  const sanitizedMessage = escapeHtml(message).replace(/\n/g, '<br>')
  const fromAddress =
    process.env.EMAIL_FROM ?? 'YourMajor <noreply@resend.dev>'

  try {
    await resend.emails.send({
      from: fromAddress,
      to: 'hartleyfanson@gmail.com',
      subject: `[YourMajor Feedback] ${categoryLabel} - ${stars}`,
      html: `
        <h2>New Feedback Received</h2>
        <p><strong>Rating:</strong> ${stars} (${rating}/5)</p>
        <p><strong>Category:</strong> ${categoryLabel}</p>
        <p><strong>From:</strong> ${email ? escapeHtml(email) : 'Anonymous'}</p>
        <hr />
        <p>${sanitizedMessage}</p>
      `,
    })
  } catch (err) {
    console.error('[feedback] Failed to send email:', err)
    return NextResponse.json(
      { error: 'Failed to send feedback. Please try again later.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
