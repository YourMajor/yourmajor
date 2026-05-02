// Server-only helpers for league communications (blast announcements).
// Reminder rules (auto-trigger before events) intentionally deferred.

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendSMS } from '@/lib/sms'
import { getLeagueRootId } from '@/lib/league-events'

export type AnnouncementChannel = 'EMAIL' | 'SMS'
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'
export type AnnouncementStatus = 'PENDING' | 'SENT' | 'CANCELED' | 'FAILED'
export type AnnouncementKind = 'BLAST' | 'TEE_TIME' | 'GROUP_CHANGE'

export type AudienceFilter =
  | { type: 'ALL_ACTIVE' }    // active LeagueRosterMembers
  | { type: 'ALL_ROSTER' }    // every LeagueRosterMember (active + inactive)
  | { type: 'CUSTOM'; userIds: string[] }
  | { type: 'TEE_TIME'; tournamentId: string; scope: 'AFFECTED' | 'ALL' }

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
  status: AnnouncementStatus
  scheduledFor: Date | null
  kind: AnnouncementKind
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

  // TEE_TIME audience filters describe an audit-only payload; the tee-time
  // notifier picks recipients itself and never asks resolveAudience to expand it.
  if (filter.type === 'TEE_TIME') return []

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
      status: 'SENT',
    },
  })

  const { deliveryCount, successCount } = await dispatchToAudience({
    announcementId: announcement.id,
    audience,
    channels: input.channels,
    subject: input.subject,
    body: input.body,
  })

  await prisma.leagueAnnouncement.update({
    where: { id: announcement.id },
    data: { sentAt: new Date() },
  })

  return { ok: true, id: announcement.id, deliveryCount, successCount }
}

/**
 * Dispatch an already-persisted PENDING announcement (the scheduled-send path).
 * The cron processor calls this for each row whose `scheduledFor` has elapsed.
 * On success the row's `status` flips to SENT; on a hard failure to FAILED.
 */
export async function dispatchPendingAnnouncement(
  announcementId: string,
): Promise<{ ok: true; deliveryCount: number; successCount: number } | { ok: false; error: string }> {
  const row = await prisma.leagueAnnouncement.findUnique({
    where: { id: announcementId },
    select: {
      id: true,
      status: true,
      subject: true,
      body: true,
      channels: true,
      audienceFilter: true,
      rootTournamentId: true,
    },
  })
  if (!row) return { ok: false, error: 'Announcement not found.' }
  if (row.status !== 'PENDING') return { ok: false, error: `Cannot dispatch — status is ${row.status}.` }

  try {
    const audience = await resolveAudience(
      row.rootTournamentId,
      row.audienceFilter as unknown as AudienceFilter,
    )
    if (audience.length === 0) {
      // Nothing to send to — flip to SENT so we don't keep retrying. Empty roster
      // at scheduled time is the admin's responsibility, not a system fault.
      await prisma.leagueAnnouncement.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: new Date() },
      })
      return { ok: true, deliveryCount: 0, successCount: 0 }
    }

    const { deliveryCount, successCount } = await dispatchToAudience({
      announcementId: row.id,
      audience,
      channels: row.channels as AnnouncementChannel[],
      subject: row.subject,
      body: row.body,
    })

    await prisma.leagueAnnouncement.update({
      where: { id: row.id },
      data: { status: 'SENT', sentAt: new Date() },
    })

    return { ok: true, deliveryCount, successCount }
  } catch (e) {
    await prisma.leagueAnnouncement.update({
      where: { id: row.id },
      data: { status: 'FAILED' },
    })
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Pre-create per-recipient delivery rows, then dispatch in batches so external
 * rate-limit failures don't take everything down. Returns counts.
 */
async function dispatchToAudience(args: {
  announcementId: string
  audience: AudienceUser[]
  channels: AnnouncementChannel[]
  subject: string
  body: string
}): Promise<{ deliveryCount: number; successCount: number }> {
  const { announcementId, audience, channels, subject, body } = args

  const deliveries: { userId: string; channel: AnnouncementChannel }[] = []
  for (const user of audience) {
    for (const channel of channels) {
      if (channel === 'SMS' && (!user.phone || !user.smsNotifications)) {
        await prisma.leagueAnnouncementDelivery.create({
          data: {
            announcementId,
            userId: user.id,
            channel,
            status: 'SKIPPED' satisfies DeliveryStatus,
            failureReason: !user.phone ? 'no phone on file' : 'sms notifications opted out',
          },
        })
        continue
      }
      if (channel === 'EMAIL' && !user.email) {
        await prisma.leagueAnnouncementDelivery.create({
          data: {
            announcementId,
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
          announcementId,
          userId: user.id,
          channel,
          status: 'PENDING' satisfies DeliveryStatus,
        },
      })
    }
  }

  let successCount = 0
  const userById = new Map(audience.map((u) => [u.id, u]))

  for (let i = 0; i < deliveries.length; i += SMS_BATCH) {
    const batch = deliveries.slice(i, i + SMS_BATCH)
    const settled = await Promise.allSettled(
      batch.map(async (d) => {
        const user = userById.get(d.userId)!
        if (d.channel === 'EMAIL') {
          await sendEmail(user.email, subject.trim(), htmlBody(body, subject))
        } else {
          await sendSMS(user.phone!, `${subject.trim()}\n\n${body.trim()}`)
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
        where: { announcementId, userId: user.id, channel: d.channel },
        data: {
          status,
          failureReason: failureReason ?? undefined,
          deliveredAt: new Date(),
        },
      })
    }
  }

  return { deliveryCount: deliveries.length, successCount }
}

/**
 * Write an audit-only LeagueAnnouncement row (kind = TEE_TIME / GROUP_CHANGE)
 * + per-recipient delivery rows reflecting an out-of-band send the caller
 * already performed. The deliveries record what the caller just did, so this
 * does NOT dispatch any email/SMS itself.
 */
export async function logOutboundCommunication(args: {
  rootTournamentId: string
  kind: AnnouncementKind
  subject: string
  body: string
  channels: AnnouncementChannel[]
  audienceFilter: AudienceFilter
  sentByUserId: string
  deliveries: {
    userId: string
    channel: AnnouncementChannel
    status: DeliveryStatus
    failureReason?: string | null
  }[]
}): Promise<{ id: string }> {
  const announcement = await prisma.leagueAnnouncement.create({
    data: {
      rootTournamentId: args.rootTournamentId,
      subject: args.subject,
      body: args.body,
      channels: args.channels,
      audienceFilter: args.audienceFilter as unknown as object,
      sentByUserId: args.sentByUserId,
      status: 'SENT',
      sentAt: new Date(),
      kind: args.kind,
    },
    select: { id: true },
  })

  if (args.deliveries.length > 0) {
    await prisma.leagueAnnouncementDelivery.createMany({
      data: args.deliveries.map((d) => ({
        announcementId: announcement.id,
        userId: d.userId,
        channel: d.channel,
        status: d.status,
        failureReason: d.failureReason ?? null,
        deliveredAt: d.status === 'SENT' ? new Date() : null,
      })),
    })
  }

  return { id: announcement.id }
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
    take: 50,
    select: {
      id: true,
      subject: true,
      body: true,
      channels: true,
      sentAt: true,
      createdAt: true,
      status: true,
      scheduledFor: true,
      kind: true,
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
    status: r.status as AnnouncementStatus,
    scheduledFor: r.scheduledFor,
    kind: r.kind as AnnouncementKind,
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
