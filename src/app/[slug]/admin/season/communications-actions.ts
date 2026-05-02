'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getLeagueRootId } from '@/lib/league-events'
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

interface ScheduleInput extends SendInput {
  // Wall-clock ISO timestamp from the browser's <input type="datetime-local">.
  // Server validates `> now()` before accepting.
  scheduledFor: string
}

async function assertAdmin(tournamentId: string): Promise<{ userId: string } | { error: string }> {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  if (user.role === 'ADMIN') return { userId: user.id }
  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { isAdmin: true },
  })
  if (!membership?.isAdmin) {
    return { error: 'Only league admins can manage announcements.' }
  }
  return { userId: user.id }
}

export async function sendLeagueAnnouncement(
  input: SendInput,
): Promise<{ ok: true; deliveryCount: number; successCount: number } | { ok: false; error: string }> {
  const auth = await assertAdmin(input.tournamentId)
  if ('error' in auth) return { ok: false, error: auth.error }

  const result = await sendAnnouncementImpl({
    tournamentId: input.tournamentId,
    subject: input.subject,
    body: input.body,
    channels: input.channels,
    audienceFilter: input.audienceFilter,
    sentByUserId: auth.userId,
  })

  if (result.ok) {
    revalidatePath(`/${input.slug}/admin/communications`)
  }

  return result
}

export async function scheduleLeagueAnnouncement(
  input: ScheduleInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await assertAdmin(input.tournamentId)
  if ('error' in auth) return { ok: false, error: auth.error }

  if (!input.subject.trim()) return { ok: false, error: 'Subject is required.' }
  if (!input.body.trim()) return { ok: false, error: 'Body is required.' }
  if (input.channels.length === 0) return { ok: false, error: 'At least one channel is required.' }

  const scheduledFor = new Date(input.scheduledFor)
  if (Number.isNaN(scheduledFor.getTime())) {
    return { ok: false, error: 'Invalid scheduled date.' }
  }
  // Require at least 1 minute in the future so cron has time to pick it up.
  if (scheduledFor.getTime() < Date.now() + 60_000) {
    return { ok: false, error: 'Schedule time must be at least one minute in the future.' }
  }

  const rootId = await getLeagueRootId(input.tournamentId)
  if (!rootId) return { ok: false, error: 'Not part of a league chain.' }

  const announcement = await prisma.leagueAnnouncement.create({
    data: {
      rootTournamentId: rootId,
      subject: input.subject.trim(),
      body: input.body.trim(),
      channels: input.channels,
      audienceFilter: input.audienceFilter as unknown as object,
      sentByUserId: auth.userId,
      status: 'PENDING',
      scheduledFor,
      kind: 'BLAST',
    },
    select: { id: true },
  })

  revalidatePath(`/${input.slug}/admin/communications`)
  return { ok: true, id: announcement.id }
}

export async function cancelScheduledAnnouncement(
  announcementId: string,
  slug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const announcement = await prisma.leagueAnnouncement.findUnique({
    where: { id: announcementId },
    select: { rootTournamentId: true, status: true },
  })
  if (!announcement) return { ok: false, error: 'Announcement not found.' }

  const auth = await assertAdmin(announcement.rootTournamentId)
  if ('error' in auth) return { ok: false, error: auth.error }

  if (announcement.status !== 'PENDING') {
    return { ok: false, error: 'Only pending announcements can be canceled.' }
  }

  await prisma.leagueAnnouncement.update({
    where: { id: announcementId },
    data: { status: 'CANCELED' },
  })

  revalidatePath(`/${slug}/admin/communications`)
  return { ok: true }
}
