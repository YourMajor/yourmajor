// Server-only helpers for league communications (blast announcements).
// Reminder rules (auto-trigger before events) intentionally deferred.

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendSMS } from '@/lib/sms'
import { getLeagueRootId } from '@/lib/league-events'

export type AnnouncementChannel = 'EMAIL' | 'SMS'
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'

export type AudienceFilter =
  | { type: 'ALL_ACTIVE' }    // active LeagueRosterMembers
  | { type: 'ALL_ROSTER' }    // every LeagueRosterMember (active + inactive)
  | { type: 'CUSTOM'; userIds: string[] }

export interface SendAnnouncementInput {
  tournamentId: string                 // any id in the league chain — we resolve to the root
  subject: string
  body: string
  channels: AnnouncementChannel[]
  audienceFilter: AudienceFilter
  sentByUserId: string
}

export interface AnnouncementSummary {
  id: string
  subject: string
  bodyPreview: string
  channels: AnnouncementChannel[]
  sentAt: Date | null
  createdAt: Date
  sentByName: string | null
  deliveryCount: number
  successCount: number
}

const SMS_BATCH = 50

interface AudienceUser {
  id: string
  name: string | null
  email: string
  phone: string | null
  smsNotifications: boolean
}

/**
 * Resolve the audience filter into a list of users. Always scoped to the
 * league's root roster (members are stored against the root tournament).
 */
export async function resolveAudience(
  tournamentId: string,
  filter: AudienceFilter,
): Promise<AudienceUser[]> {
  const rootId = await getLeagueRootId(tournamentId)
  if (!rootId) return []

  const roster = await prisma.leagueRoster.findUnique({
    where: { rootTournamentId: rootId },
    select: {
      members: {
        select: {
          status: true,
          user: {
            select: { id: true, name: true, email: true, phone: true, smsNotifications: true },
          },
        },
      },
    },
  })
  if (!roster) return []

  let members = roster.members
  if (filter.type === 'ALL_ACTIVE') {
    members = members.filter((m) => m.status === 'ACTIVE')
  }
  if (filter.type === 'CUSTOM') {
    const ids = new Set(filter.userIds)
    members = members.filter((m) => ids.has(m.user.id))
  }

  return members.map((m) => m.user)
}

/**
 * Send a blast announcement. Creates the LeagueAnnouncement row, fans out a
 * LeagueAnnouncementDelivery per (user × channel), then dispatches sends in
 * batches (so a Twilio rate limit failure doesn't block the rest).
 */
export async function sendAnnouncement(
  input: SendAnnouncementInput,
): Promise<{ ok: true; id: string; deliveryCount: number; successCount: number } | { ok: false; error: string }> {
  if (!input.subject.trim()) return { ok: false, error: 'Subject is required.' }
  if (!input.body.trim()) return { ok: false, error: 'Body is required.' }
  if (input.channels.length === 0) return { ok: false, error: 'At least one channel is required.' }

  const rootId = await getLeagueRootId(input.tournamentId)
  if (!rootId) return { ok: false, error: 'Not part of a league chain.' }

  const audience = await resolveAudience(input.tournamentId, input.audienceFilter)
  if (audience.length === 0) {
    return { ok: false, error: 'Audience is empty — no recipients to send to.' }
  }

  const announcement = await prisma.leagueAnnouncement.create({
    data: {
      rootTournamentId: rootId,
      subject: input.subject.trim(),
      body: input.body.trim(),
      channels: input.channels,
      audienceFilter: input.audienceFilter as unknown as object,
      sentByUserId: input.sentByUserId,
    },
  })

  // Pre-create one delivery row per (user × channel).
  const deliveries: { userId: string; channel: AnnouncementChannel }[] = []
  for (const user of audience) {
    for (const channel of input.channels) {
      // Skip SMS for users who haven't opted in or have no phone.
      if (channel === 'SMS' && (!user.phone || !user.smsNotifications)) {
        await prisma.leagueAnnouncementDelivery.create({
          data: {
            announcementId: announcement.id,
            userId: user.id,
            channel,
            status: 'SKIPPED' satisfies DeliveryStatus,
            failureReason: !user.phone ? 'no phone on file' : 'sms notifications opted out',
          },
        })
        continue
      }
      // Skip EMAIL when no address (shouldn't happen but be defensive).
      if (channel === 'EMAIL' && !user.email) {
        await prisma.leagueAnnouncementDelivery.create({
          data: {
            announcementId: announcement.id,
            userId: user.id,
            channel,
            status: 'SKIPPED' satisfies DeliveryStatus,
            failureReason: 'no email on file',
          },
        })
        continue
      }
      deliveries.push({ userId: user.id, channel })
      await prisma.leagueAnnouncementDelivery.create({
        data: {
          announcementId: announcement.id,
          userId: user.id,
          channel,
          status: 'PENDING' satisfies DeliveryStatus,
        },
      })
    }
  }

  // Dispatch in batches so external rate limits don't take everything down.
  let successCount = 0
  const userById = new Map(audience.map((u) => [u.id, u]))

  for (let i = 0; i < deliveries.length; i += SMS_BATCH) {
    const batch = deliveries.slice(i, i + SMS_BATCH)
    const settled = await Promise.allSettled(
      batch.map(async (d) => {
        const user = userById.get(d.userId)!
        if (d.channel === 'EMAIL') {
          await sendEmail(user.email, input.subject.trim(), htmlBody(input.body, input.subject))
        } else {
          await sendSMS(user.phone!, `${input.subject.trim()}\n\n${input.body.trim()}`)
        }
        return d
      }),
    )

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j]
      const d = batch[j]
      const user = userById.get(d.userId)!
      const status: DeliveryStatus = result.status === 'fulfilled' ? 'SENT' : 'FAILED'
      const failureReason = result.status === 'rejected' ? String(result.reason).slice(0, 200) : null
      if (status === 'SENT') successCount++

      await prisma.leagueAnnouncementDelivery.updateMany({
        where: { announcementId: announcement.id, userId: user.id, channel: d.channel },
        data: {
          status,
          failureReason: failureReason ?? undefined,
          deliveredAt: new Date(),
        },
      })
    }
  }

  await prisma.leagueAnnouncement.update({
    where: { id: announcement.id },
    data: { sentAt: new Date() },
  })

  return {
    ok: true,
    id: announcement.id,
    deliveryCount: deliveries.length,
    successCount,
  }
}

/**
 * List recent announcements for a league with delivery counts.
 */
export async function listAnnouncements(tournamentId: string): Promise<AnnouncementSummary[]> {
  const rootId = await getLeagueRootId(tournamentId)
  if (!rootId) return []

  const rows = await prisma.leagueAnnouncement.findMany({
    where: { rootTournamentId: rootId },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      subject: true,
      body: true,
      channels: true,
      sentAt: true,
      createdAt: true,
      sentBy: { select: { name: true } },
      deliveries: { select: { status: true } },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    bodyPreview: r.body.slice(0, 140),
    channels: r.channels as AnnouncementChannel[],
    sentAt: r.sentAt,
    createdAt: r.createdAt,
    sentByName: r.sentBy?.name ?? null,
    deliveryCount: r.deliveries.length,
    successCount: r.deliveries.filter((d) => d.status === 'SENT').length,
  }))
}

function htmlBody(body: string, subject: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
  return `<h2>${subject.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h2><div>${escaped}</div>`
}
