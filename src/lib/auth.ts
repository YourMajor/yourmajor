import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getUserTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import type { User } from '../generated/prisma/client'

export async function getUser(): Promise<User | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return null
    // Prisma User.id mirrors Supabase user.id (set at signup in
    // /api/auth/callback). Looking up by id avoids the email-rebinding
    // fragility where a changed Supabase email could match a different
    // Prisma user row.
    const byId = await prisma.user.findUnique({ where: { id: user.id } })
    if (byId) return byId
    // Legacy fallback: older rows may predate id-mirroring. Match by email
    // only when no id match exists.
    if (user.email) {
      return await prisma.user.findUnique({ where: { email: user.email } })
    }
    return null
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
