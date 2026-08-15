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

  const seatsFull = `You've used all ${seatLimit} admin seats on your plan. Upgrade to Tour for 5 seats.`

  const existingCount = await prisma.accountAdmin.count({
    where: { ownerUserId: user.id },
  })

  // Owner counts as 1 seat; existing AccountAdmin rows are the additional seats.
  if (existingCount + 1 >= seatLimit) {
    return { error: seatsFull }
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

  // The pre-flight count above is the friendly path, not the guarantee: two
  // concurrent invitations both read it before either writes. This is the
  // enforcement.
  //
  // Statement 1 takes a transaction-scoped advisory lock keyed to the account.
  // Statement 2 then re-counts the seats in the INSERT's own WHERE clause —
  // under READ COMMITTED it takes a fresh snapshot at statement start, i.e.
  // after the lock was granted, so the recount sees every sibling that
  // committed before us, and no sibling can commit while we hold the lock.
  // The conditional insert alone would not be enough (concurrent statements
  // would each count without seeing each other); the lock alone would not be
  // enough either, hence the same try-lock guards the insert.
  //
  // Both statements are raw SQL in a *batch* transaction, so no application
  // code sits inside BEGIN/COMMIT, and `try` never waits — neither can pin a
  // pooled connection. The key is private to this action, so it cannot collide
  // with the ordinary writes to the owner's User row (avatar, profile edits,
  // Stripe customer id).
  //
  // `id` is supplied explicitly: the column has no database default, and the
  // timestamps are computed as UTC in SQL to match how Prisma stores DateTime.
  // ponytail: hashtext() is 32-bit, so two accounts could in principle share a
  // key and serialise against each other; the loser is told to retry.
  const [lock, inserted] = await prisma.$transaction([
    prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${user.id}::text)::bigint) AS locked
    `,
    prisma.$executeRaw`
      INSERT INTO "AccountAdmin" ("id", "ownerUserId", "adminUserId", "invitedEmail", "acceptedAt", "createdAt")
      SELECT ${crypto.randomUUID()}, ${user.id}, ${invitee.id}, ${normalizedEmail},
             now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
      WHERE pg_try_advisory_xact_lock(hashtext(${user.id}::text)::bigint)
        AND (SELECT count(*) FROM "AccountAdmin" WHERE "ownerUserId" = ${user.id})::int + 1
            < ${seatLimit}::int
    `,
  ])

  if (inserted === 0) {
    // Nothing was written. Either the seats genuinely filled up between the
    // pre-flight count and here, or another invitation on this same account
    // held the lock — only the second case is a retry.
    return {
      error: lock[0]?.locked
        ? seatsFull
        : 'Another invitation on your account is being processed. Try again in a moment.',
    }
  }

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
