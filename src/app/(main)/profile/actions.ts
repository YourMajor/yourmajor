'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { normalizePhone } from '@/lib/phone'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { getAppUrl } from '@/lib/app-url'

type ActionResult = { ok: true } | { ok: false; error: string }

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().max(60).optional().default(''),
  email: z.string().trim().toLowerCase().email('A valid email address is required').max(254),
  handicap: z.number().min(0).max(54).nullable(),
  phone: z.string().nullable(),
  smsNotifications: z.boolean(),
})

export async function updateProfile(
  formData: FormData
): Promise<{ success: true; notice?: string } | { error: string }> {
  const user = await getUser()
  if (!user) return { error: 'Unauthorized' }

  const handicapStr = formData.get('handicap') as string | null
  const rawHandicap = handicapStr != null && handicapStr !== '' ? parseFloat(handicapStr) : null
  const rawPhone = (formData.get('phone') as string | null)?.trim() || null

  const result = profileSchema.safeParse({
    firstName: (formData.get('firstName') as string | null) ?? '',
    lastName: (formData.get('lastName') as string | null) ?? '',
    email: (formData.get('email') as string | null) ?? '',
    handicap: rawHandicap !== null && Number.isFinite(rawHandicap) ? rawHandicap : null,
    phone: rawPhone ? normalizePhone(rawPhone) : null,
    smsNotifications: formData.get('smsNotifications') === '1',
  })
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { firstName, lastName, email, handicap, phone, smsNotifications } = result.data

  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  try {
    // The email change is one field of this form, and it is the only one that
    // can fail for reasons outside the caller's control — a mistyped address
    // that already has an account, or the hourly send limit below. Every exit
    // from the branch (sent, rate-limited, or refused by Supabase) therefore
    // leaves a notice and falls through: none of them may discard the name,
    // handicap, phone and SMS edits saved further down. The notice always
    // names the email specifically and never claims a change that did not
    // happen.
    let notice: string | undefined

    if (email !== user.email) {
      const supabase = await createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return { error: 'Session expired. Please sign in again.' }

      // One outbound confirmation email per call, to an address the caller
      // supplies — keyed on the caller, not the IP, so a shared network or a
      // rotating address buys nothing.
      const { ok } = await checkRateLimit(`email-change:${user.id}`, LIMITS.emailChange)
      if (!ok) {
        notice =
          'Your profile was saved, but the email change was not sent — too many attempts. Try again in an hour.'
      } else {
        // User-scoped, not the service-role admin API. This mails a
        // confirmation link to the new address and the account keeps its
        // current sign-in email until that link is opened; the admin API
        // rebound the login address on the spot, with no proof the caller
        // owned it and no mail sent.
        const { error: authError } = await supabase.auth.updateUser(
          { email },
          { emailRedirectTo: `${getAppUrl()}/api/auth/callback` },
        )
        notice = authError
          ? 'Your profile was saved, but the email could not be changed. That address may already be in use.'
          : `Your profile was saved. Check ${email} for a confirmation link — you sign in with your current email until you open it.`
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      // No email here, on purpose: the mirror follows the verified address in
      // getUser() once the confirmation link is opened, so it can never move
      // ahead of the verification.
      data: { name: fullName, phone, smsNotifications },
    })

    const profileData: { displayName: string; handicap?: number } = { displayName: fullName }
    if (handicap !== null && !isNaN(handicap) && handicap >= 0 && handicap <= 54) {
      profileData.handicap = handicap
    }

    await prisma.playerProfile.upsert({
      where: { userId: user.id },
      update: profileData,
      create: { userId: user.id, ...profileData },
    })

    // Sync handicap to tournament memberships that have not started scoring.
    //
    // This used to be a bare `where: { userId }`. TournamentPlayer.handicap is
    // the snapshot every net score and rank is computed from, and season points
    // are derived from those ranks, so an unscoped write let a profile edit
    // reorder a finished leaderboard and the season standings behind it. The
    // fan-out now stops at events that are still open and rows with no scores
    // on them; a completed event, or a card already in progress, keeps the
    // handicap it was played under.
    if (profileData.handicap !== undefined) {
      await prisma.tournamentPlayer.updateMany({
        where: {
          userId: user.id,
          tournament: { status: { not: 'COMPLETED' } },
          scores: { none: {} },
        },
        data: { handicap: profileData.handicap },
      })
    }

    revalidatePath('/profile')
    return { success: true, notice }
  } catch {
    return { error: 'Something went wrong. Please try again.' }
  }
}

// ─── Web Push subscriptions ───────────────────────────────────────────────────

const subscribePushSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
  userAgent: z.string().max(512).optional(),
})

export async function subscribePush(input: {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}): Promise<ActionResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const parsed = subscribePushSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid subscription' }
  }
  const { endpoint, p256dh, auth, userAgent } = parsed.data

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: user.id, endpoint, p256dh, auth, userAgent: userAgent ?? null },
      update: { userId: user.id, p256dh, auth, userAgent: userAgent ?? null },
    })
    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to save subscription.' }
  }
}

export async function unsubscribePush(endpoint: string): Promise<ActionResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }
  if (!endpoint) return { ok: false, error: 'Missing endpoint' }
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } })
    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to remove subscription.' }
  }
}

const prefsSchema = z.object({
  notifyChatMessages: z.boolean(),
  notifyAdminAnnouncements: z.boolean(),
})

export async function updatePushPreferences(input: {
  notifyChatMessages: boolean
  notifyAdminAnnouncements: boolean
}): Promise<ActionResult> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }
  const parsed = prefsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid preferences' }
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        notifyChatMessages: parsed.data.notifyChatMessages,
        notifyAdminAnnouncements: parsed.data.notifyAdminAnnouncements,
      },
    })
    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to update preferences.' }
  }
}
