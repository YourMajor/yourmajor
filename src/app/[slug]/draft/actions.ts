'use server'

import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function togglePowerupFavorite(
  powerupId: string,
): Promise<{ favorited: boolean }> {
  const user = await getUser()
  if (!user) throw new Error('Not authenticated')

  const existing = await prisma.powerupFavorite.findUnique({
    where: { userId_powerupId: { userId: user.id, powerupId } },
  })
  if (existing) {
    await prisma.powerupFavorite.delete({
      where: { userId_powerupId: { userId: user.id, powerupId } },
    })
    return { favorited: false }
  }
  await prisma.powerupFavorite.create({
    data: { userId: user.id, powerupId },
  })
  return { favorited: true }
}
