'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import {
  sendAnnouncement as sendAnnouncementImpl,
  type AnnouncementChannel,
  type AudienceFilter,
} from '@/lib/league-announcements'

interface SendInput {
  tournamentId: string
  slug: string
  subject: string
  body: string
  channels: AnnouncementChannel[]
  audienceFilter: AudienceFilter
}

export async function sendLeagueAnnouncement(
  input: SendInput,
): Promise<{ ok: true; deliveryCount: number; successCount: number } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  if (user.role !== 'ADMIN') {
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: input.tournamentId, userId: user.id } },
      select: { isAdmin: true },
    })
    if (!membership?.isAdmin) {
      return { ok: false, error: 'Only league admins can send announcements.' }
    }
  }

  const result = await sendAnnouncementImpl({
    tournamentId: input.tournamentId,
    subject: input.subject,
    body: input.body,
    channels: input.channels,
    audienceFilter: input.audienceFilter,
    sentByUserId: user.id,
  })

  if (result.ok) {
    revalidatePath(`/${input.slug}/admin/season`)
  }

  return result
}
