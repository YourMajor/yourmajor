'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth, isTournamentAdmin } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push'

export async function closeRegistrationAndGoLive(tournamentId: string) {
  const user = await requireAuth()
  if (!(await isTournamentAdmin(user.id, tournamentId))) {
    throw new Error('Forbidden')
  }

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

export async function sendAnnouncement(
  tournamentId: string,
  message: string,
): Promise<{ ok: true; recipients: number } | { ok: false; error: string }> {
  const user = await requireAuth()
  if (!(await isTournamentAdmin(user.id, tournamentId))) {
    return { ok: false, error: 'Forbidden' }
  }
  const trimmed = message.trim()
  if (!trimmed) return { ok: false, error: 'Message is required.' }
  if (trimmed.length > 500) return { ok: false, error: 'Message must be 500 characters or fewer.' }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true, slug: true },
  })
  if (!tournament) return { ok: false, error: 'Tournament not found.' }

  const recipients = await prisma.tournamentPlayer.findMany({
    where: {
      tournamentId,
      isParticipant: true,
      user: { notifyAdminAnnouncements: true },
    },
    select: { userId: true },
  })

  if (recipients.length === 0) return { ok: true, recipients: 0 }

  const url = `/${tournament.slug}`
  await Promise.allSettled(
    recipients.map((r) =>
      sendPushToUser(r.userId, {
        title: `${tournament.name} — Announcement`,
        body: trimmed,
        url,
      }),
    ),
  )

  return { ok: true, recipients: recipients.length }
}
