'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getUserTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'

export async function inviteCoAdmin(email: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireAuth()

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: 'Please enter a valid email address.' }
  }

  if (normalizedEmail === user.email.toLowerCase()) {
    return { error: "You can't invite yourself." }
  }

  const { tier } = await getUserTier(user.id)
  const seatLimit = TIER_LIMITS[tier].maxAdminSeats

  if (seatLimit <= 1) {
    return { error: 'Co-admins are available on the Club and Tour plans.' }
  }

  const existingCount = await prisma.accountAdmin.count({
    where: { ownerUserId: user.id },
  })

  // Owner counts as 1 seat; existing AccountAdmin rows are the additional seats.
  if (existingCount + 1 >= seatLimit) {
    return {
      error: `You've used all ${seatLimit} admin seats on your plan. Upgrade to Tour for 5 seats.`,
    }
  }

  const invitee = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!invitee) {
    return {
      error: `No YourMajor account found for ${normalizedEmail}. Ask them to sign up first, then try again.`,
    }
  }

  const existingLink = await prisma.accountAdmin.findUnique({
    where: { ownerUserId_adminUserId: { ownerUserId: user.id, adminUserId: invitee.id } },
  })
  if (existingLink) {
    return { error: 'That user is already a co-admin on your account.' }
  }

  await prisma.accountAdmin.create({
    data: {
      ownerUserId: user.id,
      adminUserId: invitee.id,
      invitedEmail: normalizedEmail,
      acceptedAt: new Date(),
    },
  })

  revalidatePath('/team')
  return { ok: true }
}

export async function removeCoAdmin(accountAdminId: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireAuth()

  const link = await prisma.accountAdmin.findUnique({
    where: { id: accountAdminId },
    select: { ownerUserId: true },
  })
  if (!link) return { error: 'Co-admin not found.' }
  if (link.ownerUserId !== user.id) return { error: 'You can only remove co-admins from your own account.' }

  await prisma.accountAdmin.delete({ where: { id: accountAdminId } })
  revalidatePath('/team')
  return { ok: true }
}
