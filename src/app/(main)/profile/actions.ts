'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { normalizePhone } from '@/lib/phone'

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
): Promise<{ success: true } | { error: string }> {
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
    if (email !== user.email) {
      const supabase = await createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return { error: 'Session expired. Please sign in again.' }

      const { supabaseAdmin } = await import('@/lib/supabase')
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        { email }
      )
      if (authError) return { error: 'Failed to update email. It may already be in use.' }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { name: fullName, email, phone, smsNotifications },
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

    // Sync handicap to all tournament memberships so scorecards stay current
    if (profileData.handicap !== undefined) {
      await prisma.tournamentPlayer.updateMany({
        where: { userId: user.id },
        data: { handicap: profileData.handicap },
      })
    }

    revalidatePath('/profile')
    return { success: true }
  } catch {
    return { error: 'Something went wrong. Please try again.' }
  }
}
