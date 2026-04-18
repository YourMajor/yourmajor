import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import type { User } from '../generated/prisma/client'

export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  return prisma.user.findUnique({ where: { email: user.email } })
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
