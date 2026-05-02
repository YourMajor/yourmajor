'use server'

import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { sendEmail } from '@/lib/email'
import { sendSMS } from '@/lib/sms'
import { autoAssign, type AssignMode, type AssignablePlayer } from '@/lib/group-assignment'
import { getRecentPartners, getLeagueRootId } from '@/lib/league-events'
import {
  logOutboundCommunication,
  type AnnouncementChannel,
  type DeliveryStatus,
} from '@/lib/league-announcements'

// Per-recipient outcome captured while a tee-time notify batch dispatches.
// Used to seed the LeagueAnnouncement audit row at the end.
interface TeeTimeDelivery {
  userId: string
  channel: AnnouncementChannel
  status: DeliveryStatus
  failureReason?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface TeeTimeDispatch {
  tournamentPlayerId: string
  userId: string
  email: string | null
  phone: string | null
  smsNotifications: boolean
  groupName: string
  teeTimeStr: string | null
  startingHole: number | null
  memberNames: string[]
  payload: {
    groupName: string
    teeTime: string | null
    startingHole: number | null
    groupMembers: string[]
  }
  tournamentName: string
}

interface GroupForNotify {
  name: string
  teeTime: Date | null
  startingHole: number | null
  members: Array<{
    tournamentPlayer: {
      user: { name: string | null; email: string }
    }
  }>
}

interface MemberForNotify {
  tournamentPlayer: {
    id: string
    user: {
      id: string
      name: string | null
      email: string
      phone: string | null
      smsNotifications: boolean
    }
  }
}

function buildTeeTimeDispatch(
  group: GroupForNotify,
  member: MemberForNotify,
  tournamentName: string,
): TeeTimeDispatch {
  const teeTimeStr = group.teeTime
    ? new Date(group.teeTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null
  const memberNames = group.members.map((m) => m.tournamentPlayer.user.name ?? m.tournamentPlayer.user.email)
  const player = member.tournamentPlayer
  return {
    tournamentPlayerId: player.id,
    userId: player.user.id,
    email: player.user.email ?? null,
    phone: player.user.phone,
    smsNotifications: player.user.smsNotifications,
    groupName: group.name,
    teeTimeStr,
    startingHole: group.startingHole,
    memberNames,
    payload: {
      groupName: group.name,
      teeTime: teeTimeStr,
      startingHole: group.startingHole,
      groupMembers: memberNames,
    },
    tournamentName,
  }
}

async function dispatchTeeTimeMessages(
  dispatches: TeeTimeDispatch[],
  slug: string,
): Promise<TeeTimeDelivery[]> {
  const domain = process.env.NEXT_PUBLIC_APP_URL || 'https://yourmajor.club'
  const deliveries: TeeTimeDelivery[] = []

  // Send each player's email + SMS in parallel — they're independent, so a
  // slow Resend call to one address shouldn't gate the next.
  await Promise.all(
    dispatches.map(async (d) => {
      if (d.email) {
        const membersHtml = d.memberNames.map((n) => `<li>${n}</li>`).join('')
        try {
          await sendEmail(
            d.email,
            `Your tee time for ${d.tournamentName}`,
            `<h2>${d.tournamentName}</h2>
            <p>Your group: <strong>${d.groupName}</strong></p>
            ${d.teeTimeStr ? `<p>Tee time: <strong>${d.teeTimeStr}</strong></p>` : ''}
            ${d.startingHole ? `<p>Starting hole: <strong>#${d.startingHole}</strong></p>` : ''}
            <p>Playing with:</p>
            <ul>${membersHtml}</ul>
            <p><a href="${domain}/${slug}">View Tournament</a></p>`,
          )
          deliveries.push({ userId: d.userId, channel: 'EMAIL', status: 'SENT' })
        } catch (e) {
          deliveries.push({
            userId: d.userId,
            channel: 'EMAIL',
            status: 'FAILED',
            failureReason: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
          })
        }
      } else {
        deliveries.push({
          userId: d.userId,
          channel: 'EMAIL',
          status: 'SKIPPED',
          failureReason: 'no email on file',
        })
      }

      if (d.smsNotifications && d.phone) {
        const smsBody = [
          `${d.tournamentName} — Group: ${d.groupName}`,
          d.teeTimeStr ? `Tee time: ${d.teeTimeStr}` : null,
          d.startingHole ? `Starting hole: #${d.startingHole}` : null,
          `Playing with: ${d.memberNames.join(', ')}`,
        ].filter(Boolean).join('\n')
        try {
          await sendSMS(d.phone, smsBody)
          deliveries.push({ userId: d.userId, channel: 'SMS', status: 'SENT' })
        } catch (e) {
          deliveries.push({
            userId: d.userId,
            channel: 'SMS',
            status: 'FAILED',
            failureReason: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
          })
        }
      }
    }),
  )

  return deliveries
}

async function requireTournamentAdmin(tournamentId: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  if (user.role !== 'ADMIN') {
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: user.id } },
      select: { isAdmin: true },
    })
    if (!membership?.isAdmin) throw new Error('Forbidden')
  }

  return user
}

// ── Group CRUD ───────────────────────────────────────────────────────────────

export async function createGroup(tournamentId: string, name: string) {
  await requireTournamentAdmin(tournamentId)

  const group = await prisma.tournamentGroup.create({
    data: { tournamentId, name },
  })

  return group
}

export async function deleteGroup(tournamentId: string, groupId: string) {
  await requireTournamentAdmin(tournamentId)

  await prisma.tournamentGroup.delete({ where: { id: groupId } })
}

export async function renameGroup(tournamentId: string, groupId: string, name: string) {
  await requireTournamentAdmin(tournamentId)

  await prisma.tournamentGroup.update({ where: { id: groupId }, data: { name } })
}

// ── Player ↔ Group Assignment ────────────────────────────────────────────────

export async function movePlayerToGroup(
  tournamentId: string,
  tournamentPlayerId: string,
  targetGroupId: string | null,
) {
  await requireTournamentAdmin(tournamentId)

  if (!targetGroupId) {
    // Move back to unassigned
    await prisma.tournamentGroupMember.deleteMany({
      where: { tournamentPlayerId },
    })
    return
  }

  // Calculate next position in target group
  const maxPos = await prisma.tournamentGroupMember.aggregate({
    where: { groupId: targetGroupId },
    _max: { position: true },
  })
  const nextPosition = (maxPos._max.position ?? -1) + 1

  // Upsert: if player already in a group, move them
  await prisma.tournamentGroupMember.upsert({
    where: { tournamentPlayerId },
    create: { groupId: targetGroupId, tournamentPlayerId, position: nextPosition },
    update: { groupId: targetGroupId, position: nextPosition },
  })
}

// ── Auto-assign ──────────────────────────────────────────────────────────────

/**
 * Wipes existing groups for the tournament and re-creates them by auto-assigning
 * all participants according to the chosen mode. When `avoidLastEventPartners`
 * is true and the tournament is part of a league chain, the algorithm tries to
 * minimise pairings that already happened in the prior event and reports any
 * remaining conflicts.
 */
export async function autoAssignGroups(
  tournamentId: string,
  mode: AssignMode,
  groupSize: number = 4,
  avoidLastEventPartners: boolean = false,
): Promise<{ ok: true; groupCount: number; conflicts: number } | { ok: false; error: string }> {
  await requireTournamentAdmin(tournamentId)

  if (groupSize < 2 || groupSize > 6) {
    return { ok: false, error: 'Group size must be between 2 and 6.' }
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, slug: true, isLeague: true, parentTournamentId: true },
  })
  if (!tournament) return { ok: false, error: 'Tournament not found.' }

  const participants = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, isParticipant: true },
    select: {
      id: true,
      userId: true,
      handicap: true,
      user: { select: { name: true, email: true } },
    },
  })

  if (participants.length === 0) {
    return { ok: false, error: 'No participants to assign.' }
  }

  const players: AssignablePlayer[] = participants.map((p) => ({
    id: p.id,
    userId: p.userId,
    name: p.user.name ?? p.user.email,
    handicap: p.handicap,
  }))

  const isLeagueChild = tournament.isLeague || !!tournament.parentTournamentId
  const recentPartners =
    avoidLastEventPartners && isLeagueChild ? await getRecentPartners(tournamentId) : {}

  const { groups: assignedGroups, conflicts } = autoAssign(players, mode, groupSize, {
    avoidLastEventPartners: avoidLastEventPartners && isLeagueChild,
    recentPartners,
  })

  // Wipe and recreate groups in a single transaction. Pre-generating the
  // group IDs lets us emit `createMany` for both groups and members instead
  // of N+M sequential round-trips (was 1 + 20 + 80 = 101 queries for a
  // 20-group / 80-player assignment; now 3 statements).
  const groupRows = assignedGroups.map((_, i) => ({
    id: crypto.randomUUID(),
    tournamentId,
    name: `Group ${i + 1}`,
  }))
  const memberRows = assignedGroups.flatMap((groupPlayers, gi) =>
    groupPlayers.map((p, pos) => ({
      groupId: groupRows[gi].id,
      tournamentPlayerId: p.id,
      position: pos,
    })),
  )

  await prisma.$transaction([
    prisma.tournamentGroup.deleteMany({ where: { tournamentId } }),
    prisma.tournamentGroup.createMany({ data: groupRows }),
    prisma.tournamentGroupMember.createMany({ data: memberRows }),
  ])

  revalidatePath(`/${tournament.slug}/admin/groups`)
  return { ok: true, groupCount: assignedGroups.length, conflicts }
}

// ── Player Management ────────────────────────────────────────────────────────

export async function addLatePlayer(
  tournamentId: string,
  email: string,
): Promise<{ ok: boolean; error?: string; player?: { id: string; name: string; handicap: number } }> {
  await requireTournamentAdmin(tournamentId)

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { profile: { select: { handicap: true } } },
  })

  if (!user) {
    return { ok: false, error: 'No account found with that email address.' }
  }

  // Check if already registered
  const existing = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
  })

  if (existing && existing.isParticipant) {
    return { ok: false, error: 'This player is already registered.' }
  }

  if (existing) {
    // Admin record exists but not participant — activate
    await prisma.tournamentPlayer.update({
      where: { id: existing.id },
      data: { isParticipant: true },
    })
    return { ok: true, player: { id: existing.id, name: user.name ?? user.email, handicap: existing.handicap } }
  }

  const tp = await prisma.tournamentPlayer.create({
    data: {
      tournamentId,
      userId: user.id,
      isParticipant: true,
      handicap: user.profile?.handicap ?? 0,
    },
  })

  return { ok: true, player: { id: tp.id, name: user.name ?? user.email, handicap: tp.handicap } }
}

export async function removePlayer(tournamentId: string, tournamentPlayerId: string) {
  await requireTournamentAdmin(tournamentId)

  const tp = await prisma.tournamentPlayer.findUnique({
    where: { id: tournamentPlayerId },
    select: { isAdmin: true },
  })

  if (!tp) throw new Error('Player not found')

  // Remove from group first
  await prisma.tournamentGroupMember.deleteMany({
    where: { tournamentPlayerId },
  })

  if (tp.isAdmin) {
    // Admin stays in tournament but loses participant status
    await prisma.tournamentPlayer.update({
      where: { id: tournamentPlayerId },
      data: { isParticipant: false },
    })
  } else {
    await prisma.tournamentPlayer.delete({
      where: { id: tournamentPlayerId },
    })
  }
}

// ── Tee Time Management ──────────────────────────────────────────────────────

export async function updateGroupTeeTime(tournamentId: string, groupId: string, teeTime: string | null) {
  await requireTournamentAdmin(tournamentId)

  // teeTime comes as "HH:mm" — combine with tournament start date for full DateTime
  if (!teeTime) {
    await prisma.tournamentGroup.update({ where: { id: groupId }, data: { teeTime: null } })
    return
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(teeTime)
  if (!match) {
    throw new Error('Tee time must be HH:mm (00:00–23:59)')
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { startDate: true },
  })

  const baseDate = tournament?.startDate ?? new Date()
  const dt = new Date(baseDate)
  dt.setUTCHours(hours, minutes, 0, 0)

  await prisma.tournamentGroup.update({ where: { id: groupId }, data: { teeTime: dt } })
}

export async function updateGroupStartingHole(tournamentId: string, groupId: string, startingHole: number | null) {
  await requireTournamentAdmin(tournamentId)

  await prisma.tournamentGroup.update({ where: { id: groupId }, data: { startingHole } })
}

// ── Notify Players ──────────────────────────────────────────────────────────

/**
 * Sends notifications only to players whose group assignment, tee time,
 * or starting hole changed since the last notification.
 */
export async function notifyAffectedPlayers(
  tournamentId: string,
  slug: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const adminUser = await requireTournamentAdmin(tournamentId)

  const [tournament, groups] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { name: true },
    }),
    prisma.tournamentGroup.findMany({
      where: { tournamentId },
      include: {
        members: {
          include: {
            tournamentPlayer: {
              include: { user: { select: { id: true, name: true, email: true, phone: true, smsNotifications: true } } },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // Determine which groups/members need notification
  const affectedMembers: { group: typeof groups[number]; member: typeof groups[number]['members'][number] }[] = []

  for (const group of groups) {
    const teeTimeChanged = group.teeTime?.getTime() !== group.lastNotifiedTeeTime?.getTime()
    const startHoleChanged = group.startingHole !== group.lastNotifiedStartHole

    for (const member of group.members) {
      // Notify if: never notified, or group tee time/starting hole changed
      if (!member.notifiedAt || teeTimeChanged || startHoleChanged) {
        affectedMembers.push({ group, member })
      }
    }
  }

  if (affectedMembers.length === 0) {
    return { ok: true, count: 0 }
  }

  const now = new Date()

  // Build the dispatch list eagerly so we can detach sends from the response.
  const dispatches = affectedMembers.map(({ group, member }) =>
    buildTeeTimeDispatch(group, member, tournament?.name ?? 'Tournament'),
  )
  const memberIds = affectedMembers.map((a) => a.member.id)
  const affectedGroupIds = new Set(affectedMembers.map((a) => a.group.id))
  const affectedGroups = groups.filter((g) => affectedGroupIds.has(g.id))

  // Persist the structured Notification + tracking writes synchronously so
  // the client-side admin UI shows the new "notified" state immediately.
  await prisma.$transaction([
    prisma.notification.createMany({
      data: dispatches.map((d) => ({
        tournamentPlayerId: d.tournamentPlayerId,
        type: 'TEE_TIME_ASSIGNED',
        payload: d.payload,
      })),
    }),
    prisma.tournamentGroupMember.updateMany({
      where: { id: { in: memberIds } },
      data: { notifiedAt: now },
    }),
  ])

  // Group snapshot fields differ per group, so we run them in parallel
  // outside the transaction (small N, independent rows).
  await Promise.all(
    affectedGroups.map((group) =>
      prisma.tournamentGroup.update({
        where: { id: group.id },
        data: {
          lastNotifiedTeeTime: group.teeTime,
          lastNotifiedStartHole: group.startingHole,
        },
      }),
    ),
  )

  // Outbound email/SMS + the audit row run after the response so the admin
  // doesn't watch a spinner while N players' messages dispatch in series.
  after(async () => {
    const deliveries = await dispatchTeeTimeMessages(dispatches, slug)
    await writeTeeTimeAuditRow({
      tournamentId,
      tournamentName: tournament?.name ?? 'Tournament',
      scope: 'AFFECTED',
      deliveries,
      sentByUserId: adminUser.id,
      affectedCount: affectedMembers.length,
    }).catch((err) => console.error('[notifyAffectedPlayers] audit write failed:', err))
  })

  revalidatePath(`/${slug}/admin/groups`)
  return { ok: true, count: affectedMembers.length }
}

/**
 * Force-sends notifications to ALL players in all groups (escape hatch).
 */
export async function notifyAllPlayers(
  tournamentId: string,
  slug: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const adminUser = await requireTournamentAdmin(tournamentId)

  const [participants, groups] = await Promise.all([
    prisma.tournamentPlayer.findMany({
      where: { tournamentId, isParticipant: true },
      select: { id: true },
    }),
    prisma.tournamentGroup.findMany({
      where: { tournamentId },
      include: {
        members: {
          include: {
            tournamentPlayer: {
              include: { user: { select: { id: true, name: true, email: true, phone: true, smsNotifications: true } } },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const assignedPlayerIds = new Set(groups.flatMap((g) => g.members.map((m) => m.tournamentPlayerId)))
  const unassigned = participants.filter((p) => !assignedPlayerIds.has(p.id))

  if (unassigned.length > 0) {
    return { ok: false, error: `${unassigned.length} player${unassigned.length > 1 ? 's are' : ' is'} not assigned to a group.` }
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { name: true },
  })

  const tournamentName = tournament?.name ?? 'Tournament'
  const now = new Date()
  const dispatches: TeeTimeDispatch[] = []
  const memberIds: string[] = []
  for (const group of groups) {
    for (const member of group.members) {
      dispatches.push(buildTeeTimeDispatch(group, member, tournamentName))
      memberIds.push(member.id)
    }
  }

  await prisma.$transaction([
    prisma.notification.createMany({
      data: dispatches.map((d) => ({
        tournamentPlayerId: d.tournamentPlayerId,
        type: 'TEE_TIME_ASSIGNED',
        payload: d.payload,
      })),
    }),
    prisma.tournamentGroupMember.updateMany({
      where: { id: { in: memberIds } },
      data: { notifiedAt: now },
    }),
  ])

  await Promise.all(
    groups.map((group) =>
      prisma.tournamentGroup.update({
        where: { id: group.id },
        data: {
          lastNotifiedTeeTime: group.teeTime,
          lastNotifiedStartHole: group.startingHole,
        },
      }),
    ),
  )

  after(async () => {
    const deliveries = await dispatchTeeTimeMessages(dispatches, slug)
    await writeTeeTimeAuditRow({
      tournamentId,
      tournamentName,
      scope: 'ALL',
      deliveries,
      sentByUserId: adminUser.id,
      affectedCount: dispatches.length,
    }).catch((err) => console.error('[notifyAllPlayers] audit write failed:', err))
  })

  revalidatePath(`/${slug}/admin/groups`)
  return { ok: true, count: dispatches.length }
}

/**
 * Persist a tee-time send batch to LeagueAnnouncement for the unified
 * Communications audit trail. Skips silently for non-league tournaments —
 * the audit list is league-scoped today.
 */
async function writeTeeTimeAuditRow(args: {
  tournamentId: string
  tournamentName: string
  scope: 'AFFECTED' | 'ALL'
  deliveries: TeeTimeDelivery[]
  sentByUserId: string
  affectedCount: number
}) {
  if (args.deliveries.length === 0) return
  const rootId = await getLeagueRootId(args.tournamentId)
  if (!rootId) return

  // Channels actually exercised — drop EMAIL/SMS that were never attempted.
  const channels: AnnouncementChannel[] = []
  if (args.deliveries.some((d) => d.channel === 'EMAIL' && d.status !== 'SKIPPED')) channels.push('EMAIL')
  if (args.deliveries.some((d) => d.channel === 'SMS')) channels.push('SMS')
  if (channels.length === 0) return

  await logOutboundCommunication({
    rootTournamentId: rootId,
    kind: 'TEE_TIME',
    subject: `Tee times — ${args.tournamentName}`,
    body: `Sent tee-time assignments to ${args.affectedCount} player${args.affectedCount === 1 ? '' : 's'} (${args.scope === 'AFFECTED' ? 'affected only' : 'all players'}).`,
    channels,
    audienceFilter: { type: 'TEE_TIME', tournamentId: args.tournamentId, scope: args.scope },
    sentByUserId: args.sentByUserId,
    deliveries: args.deliveries,
  })
}
