'use server'

import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { sendInviteEmails } from '@/app/(main)/tournaments/new/actions'
import { sendSMS } from '@/lib/sms'

export async function resendInvite(invitationId: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      email: true,
      phone: true,
      token: true,
      acceptedAt: true,
      tournament: { select: { id: true, name: true, slug: true } },
    },
  })

  if (!invitation) throw new Error('Invitation not found')
  if (invitation.acceptedAt) throw new Error('Invitation already accepted')

  // Verify caller is a tournament admin
  const membership = await prisma.tournamentPlayer.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId: invitation.tournament.id,
        userId: user.id,
      },
    },
    select: { isAdmin: true },
  })
  if (!membership?.isAdmin && user.role !== 'ADMIN') {
    throw new Error('Forbidden')
  }

  const { tournament } = invitation

  if (invitation.email) {
    await sendInviteEmails(tournament.name, tournament.slug, [
      { email: invitation.email, token: invitation.token },
    ])
  }

  if (invitation.phone) {
    const domain = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    await sendSMS(
      invitation.phone,
      `You're invited to ${tournament.name}! Join here: ${domain}/${tournament.slug}/register?token=${invitation.token}`,
    )
  }
}
