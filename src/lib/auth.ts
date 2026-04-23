import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import type { User } from '../generated/prisma/client'

export async function getUser(): Promise<User | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return null
    return prisma.user.findUnique({ where: { email: user.email } })
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
  return membership?.isAdmin ?? false
}
