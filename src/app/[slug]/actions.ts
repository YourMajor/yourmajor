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
    throw new Error('Cannot unregister from a completed tournament')
  }

  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
    select: { id: true, isAdmin: true },
  })
  if (!membership) throw new Error('You are not registered for this tournament')

  // Remove from any group first
  await prisma.tournamentGroupMember.deleteMany({
    where: { tournamentPlayerId: membership.id },
  })

  if (membership.isAdmin) {
    // Admins keep their record for access — just toggle off participation
    // But clean up all participation data (scores, powerups, draft picks, notifications)
    await prisma.score.deleteMany({ where: { tournamentPlayerId: membership.id } })
    await prisma.roundPlayerTee.deleteMany({ where: { tournamentPlayerId: membership.id } })
    await prisma.playerPowerup.deleteMany({ where: { tournamentPlayerId: membership.id } })
    await prisma.draftPick.deleteMany({ where: { tournamentPlayerId: membership.id } })
    await prisma.notification.deleteMany({ where: { tournamentPlayerId: membership.id } })
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

  // Reset invitation so the user can re-register
  await prisma.invitation.updateMany({
    where: {
      tournamentId: tournament.id,
      userId: user.id,
      acceptedAt: { not: null },
    },
    data: { acceptedAt: null, userId: null },
  })

  revalidatePath(`/${slug}`)
  redirect(`/${slug}`)
}
