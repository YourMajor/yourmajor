import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getUserTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import type { User } from '../generated/prisma/client'

/**
 * Resolve the Prisma mirror row for a Supabase auth identity, claiming it the
 * first time that identity is seen.
 *
 * Rows created at signup use the auth id as their primary key. Legacy and
 * CSV-imported rows do not — their `id` is a random uuid — so they are matched
 * by email exactly once, while still unclaimed, and stamped with `authUserId`
 * from then on. After that the email is free to change without moving which
 * row an identity resolves to, which is the whole point: an address is no
 * longer proof of who you are.
 *
 * Declines (returns null) rather than resolving anything it cannot claim
 * outright — a row already claimed by another identity, or a unique collision
 * on the claim. It never renames, blanks or otherwise frees a row held by
 * someone else.
 */
export async function claimMirrorUser(
  authUserId: string,
  email: string | null,
): Promise<User | null> {
  const claimed = await prisma.user.findUnique({ where: { authUserId } })
  if (claimed) return claimed

  const candidate =
    (await prisma.user.findUnique({ where: { id: authUserId } })) ??
    // `authUserId: null` narrows the legacy fallback to rows nobody has
    // claimed. Without it, a confirmed email change would let one identity
    // resolve onto another account's row simply by arriving at its address.
    (email ? await prisma.user.findFirst({ where: { email, authUserId: null } }) : null)
  if (!candidate) return null
  if (candidate.authUserId && candidate.authUserId !== authUserId) return null

  try {
    // Monotonic, and in a statement of its own: the stamp is never overwritten
    // (the filter requires it to still be null) and never shares a write with
    // the email reconcile, so a collision on the address cannot suppress the
    // claim.
    await prisma.user.updateMany({
      where: { id: candidate.id, authUserId: null },
      data: { authUserId },
    })
  } catch (err) {
    // Any P2002 is a conflict this code must not try to resolve. Keyed on the
    // error code rather than on the target field, so no raw Prisma text can
    // escape — the auth callback echoes what it catches into /auth/login?error=.
    if ((err as { code?: string }).code === 'P2002') return null
    throw err
  }
  return { ...candidate, authUserId }
}

export async function getUser(): Promise<User | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return null

    const mirror = await claimMirrorUser(user.id, user.email ?? null)
    if (!mirror) return null

    // Supabase is the only place an email is ever proven: a changed address
    // lands on the auth user only after the confirmation link is opened. The
    // mirror follows it here, and nowhere else, so it can never run ahead of
    // that verification.
    //
    // Here rather than in the auth callback deliberately: the PKCE code
    // verifier for the confirmation only exists on the device that requested
    // the change, so a link opened on a phone when the change was made on a
    // laptop never completes a callback exchange — but the session on the
    // laptop still reports the new address the next time it calls getUser().
    if (user.email && user.email !== mirror.email) {
      try {
        return await prisma.user.update({
          where: { id: mirror.id },
          data: { email: user.email },
        })
      } catch (err) {
        // Another row holds the address. Decline — nothing here frees an email
        // held by someone else — and keep the caller on the row they own.
        console.error('[auth] email mirror reconcile failed for user', mirror.id, err)
        return mirror
      }
    }
    return mirror
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth()
  if (user.role !== 'ADMIN') throw new Error('Forbidden')
  return user
}

/**
 * Gate a server action on tournament-level admin. Sends unauthenticated
 * callers to login; throws for authenticated non-admins.
 *
 * Changed 2026-08-10: this used to be a deliberately *narrow* check (direct
 * TournamentPlayer.isAdmin only), kept separate from `isTournamentAdmin` so
 * that widening it would not hand co-admins access to every calling action.
 *
 * That split produced a visible inconsistency: the admin layout and every API
 * route gate on `isTournamentAdmin`, which honours account-level co-admins, so
 * a co-admin could open the admin screens and then be refused by the server
 * actions behind them. Resolved in favour of the wide check — co-admins now
 * genuinely administer the tournaments they co-own, and one definition of
 * "tournament admin" applies everywhere.
 */
export async function requireTournamentAdmin(tournamentId: string): Promise<User> {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  if (!(await isTournamentAdmin(user.id, tournamentId))) {
    throw new Error('Forbidden')
  }
  return user
}

export async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === 'ADMIN') return true

  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    select: { isAdmin: true },
  })
  if (membership?.isAdmin) return true

  // Account-level co-admin: a user is an admin on this tournament if they are
  // an AccountAdmin of any user who has a direct TournamentPlayer.isAdmin row,
  // and that row is still inside the owner's paid seat count (see
  // seatGrantsAdmin below — the mere existence of the row is not enough).
  // Co-admins inherit admin rights on every tournament owned by the account holder.
  //
  // We don't filter on AccountAdmin.acceptedAt — the current invite flow in
  // src/app/(main)/team/actions.ts sets acceptedAt: new Date() on insert (the
  // owner is authenticated when adding, so trust is implicit). The field
  // remains as an audit timestamp; if a deferred-acceptance flow is ever
  // wired up, re-introduce the `acceptedAt: { not: null }` filter here.
  const ownerAdmins = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, isAdmin: true },
    select: { userId: true },
  })
  if (ownerAdmins.length === 0) return false

  const coAdminLinks = await prisma.accountAdmin.findMany({
    where: {
      adminUserId: userId,
      ownerUserId: { in: ownerAdmins.map((a) => a.userId) },
    },
    select: { id: true, ownerUserId: true },
  })

  // The cap is per owner, so each candidate is resolved against its own tier.
  // Cost: this loop only runs for users who actually hold a co-admin row, and
  // there is normally exactly one such row — everyone else pays nothing beyond
  // the findMany above, which is the same single query the old findFirst was.
  for (const link of coAdminLinks) {
    if (await seatGrantsAdmin(link.ownerUserId, link.id)) return true
  }
  return false
}

/**
 * Whether an AccountAdmin row still sits inside a seat the owner's *current*
 * plan pays for. Seats are honoured oldest first: the owner occupies one of the
 * plan's seats, so the first `maxAdminSeats - 1` rows by createdAt grant admin
 * and anything past that is dormant.
 *
 * This is the read-side twin of the seat check in
 * src/app/(main)/team/actions.ts. Without it the write-time limit is the only
 * limit: a Club owner could fill their seats, cancel the subscription — which
 * drops getUserTier to FREE but leaves every AccountAdmin row in place, since
 * the Stripe webhook only flips Purchase.status — and keep handing out admin on
 * every tournament they administer.
 *
 * Nothing is deleted on a downgrade, deliberately: a dormant row starts
 * granting admin again the moment the plan is restored, with no re-invite.
 */
async function seatGrantsAdmin(ownerUserId: string, accountAdminId: string): Promise<boolean> {
  const { tier } = await getUserTier(ownerUserId)
  const honouredSeats = TIER_LIMITS[tier].maxAdminSeats - 1
  if (honouredSeats <= 0) return false

  // At most 4 rows (Tour's 5 seats minus the owner). `id` is the tiebreak so
  // rows sharing a createdAt still rank deterministically.
  const honoured = await prisma.accountAdmin.findMany({
    where: { ownerUserId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: honouredSeats,
    select: { id: true },
  })
  return honoured.some((row) => row.id === accountAdminId)
}
