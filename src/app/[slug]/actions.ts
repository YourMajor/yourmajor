'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function leaveTournament(slug: string) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, status: true },
  })
  if (!tournament) throw new Error('Tournament not found')

  if (tournament.status === 'COMPLETED') {
    throw new Error('Cannot leave a completed tournament')
  }

  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
    select: { id: true, isAdmin: true },
  })
  if (!membership) throw new Error('You are not registered for this tournament')

  if (membership.isAdmin) {
    // Admins keep their record for access — just toggle off participation
    await prisma.tournamentPlayer.update({
      where: { id: membership.id },
      data: { isParticipant: false },
    })
  } else {
    // Regular players: delete the record entirely (cascades scores, powerups, etc.)
    await prisma.tournamentPlayer.delete({
      where: { id: membership.id },
    })
  }

  revalidatePath(`/${slug}`)
  redirect(`/${slug}`)
}
