'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function closeRegistrationAndGoLive(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { slug: true },
  })
  if (!tournament) return

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      registrationClosed: true,
      status: 'ACTIVE',
    },
  })

  revalidatePath(`/${tournament.slug}/admin`)
}
