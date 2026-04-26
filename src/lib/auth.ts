import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
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

export async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === 'ADMIN') return true

  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    select: { isAdmin: true },
  })
  if (membership?.isAdmin) return true

  // Account-level co-admin: a user is an admin on this tournament if they are
  // an AccountAdmin of any user who has a direct TournamentPlayer.isAdmin row.
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

  const coAdminLink = await prisma.accountAdmin.findFirst({
    where: {
      adminUserId: userId,
      ownerUserId: { in: ownerAdmins.map((a) => a.userId) },
    },
    select: { id: true },
  })
  return !!coAdminLink
}
