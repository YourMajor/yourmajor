'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizePhone } from '@/lib/phone'

export async function updateProfile(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const user = await getUser()
  if (!user) return { error: 'Unauthorized' }

  const firstName = (formData.get('firstName') as string | null)?.trim() ?? ''
  const lastName = (formData.get('lastName') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const handicapStr = formData.get('handicap') as string | null
  const handicap = handicapStr !== null ? parseFloat(handicapStr) : null
  const rawPhone = (formData.get('phone') as string | null)?.trim() || null
  const phone = rawPhone ? normalizePhone(rawPhone) : null
  const smsNotifications = formData.get('smsNotifications') === '1'

  if (!firstName) return { error: 'First name is required' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'A valid email address is required' }
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  try {
    if (email !== user.email) {
      const supabase = await createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return { error: 'Session expired. Please sign in again.' }

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
