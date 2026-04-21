'use server'

import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email'
import { sendSMS } from '@/lib/sms'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { startDate: true },
  })

  const baseDate = tournament?.startDate ?? new Date()
  const [hours, minutes] = teeTime.split(':').map(Number)
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
  await requireTournamentAdmin(tournamentId)

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
              include: { user: { select: { name: true, email: true, phone: true, smsNotifications: true } } },
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

  const domain = process.env.NEXT_PUBLIC_APP_URL || 'https://yourmajor.club'
  const now = new Date()

  for (const { group, member } of affectedMembers) {
    const player = member.tournamentPlayer
    const teeTimeStr = group.teeTime
      ? new Date(group.teeTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : null
    const memberNames = group.members.map((m) => m.tournamentPlayer.user.name ?? m.tournamentPlayer.user.email)
    const payload = {
      groupName: group.name,
      teeTime: teeTimeStr,
      startingHole: group.startingHole,
      groupMembers: memberNames,
    }

    await prisma.notification.create({
      data: {
        tournamentPlayerId: player.id,
        type: 'TEE_TIME_ASSIGNED',
        payload,
      },
    })

    if (player.user.email) {
      const membersHtml = memberNames.map((n) => `<li>${n}</li>`).join('')
      await sendEmail(
        player.user.email,
        `Your tee time for ${tournament?.name ?? 'the tournament'}`,
        `<h2>${tournament?.name ?? 'Tournament'}</h2>
        <p>Your group: <strong>${group.name}</strong></p>
        ${teeTimeStr ? `<p>Tee time: <strong>${teeTimeStr}</strong></p>` : ''}
        ${group.startingHole ? `<p>Starting hole: <strong>#${group.startingHole}</strong></p>` : ''}
        <p>Playing with:</p>
        <ul>${membersHtml}</ul>
        <p><a href="${domain}/${slug}">View Tournament</a></p>`,
      )
    }

    if (player.user.smsNotifications && player.user.phone) {
      const smsBody = [
        `${tournament?.name ?? 'Tournament'} — Group: ${group.name}`,
        teeTimeStr ? `Tee time: ${teeTimeStr}` : null,
        group.startingHole ? `Starting hole: #${group.startingHole}` : null,
        `Playing with: ${memberNames.join(', ')}`,
      ].filter(Boolean).join('\n')
      await sendSMS(player.user.phone, smsBody)
    }

    // Mark member as notified
    await prisma.tournamentGroupMember.update({
      where: { id: member.id },
      data: { notifiedAt: now },
    })
  }

  // Update group snapshot fields for all groups that had affected members
  const affectedGroupIds = new Set(affectedMembers.map((a) => a.group.id))
  for (const group of groups) {
    if (affectedGroupIds.has(group.id)) {
      await prisma.tournamentGroup.update({
        where: { id: group.id },
        data: {
          lastNotifiedTeeTime: group.teeTime,
          lastNotifiedStartHole: group.startingHole,
        },
      })
    }
  }

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
  await requireTournamentAdmin(tournamentId)

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
              include: { user: { select: { name: true, email: true, phone: true, smsNotifications: true } } },
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

  const domain = process.env.NEXT_PUBLIC_APP_URL || 'https://yourmajor.club'
  const now = new Date()
  let notified = 0

  for (const group of groups) {
    const teeTimeStr = group.teeTime
      ? new Date(group.teeTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : null
    const memberNames = group.members.map((m) => m.tournamentPlayer.user.name ?? m.tournamentPlayer.user.email)

    for (const member of group.members) {
      const player = member.tournamentPlayer
      const payload = {
        groupName: group.name,
        teeTime: teeTimeStr,
        startingHole: group.startingHole,
        groupMembers: memberNames,
      }

      await prisma.notification.create({
        data: {
          tournamentPlayerId: player.id,
          type: 'TEE_TIME_ASSIGNED',
          payload,
        },
      })

      if (player.user.email) {
        const membersHtml = memberNames.map((n) => `<li>${n}</li>`).join('')
        await sendEmail(
          player.user.email,
          `Your tee time for ${tournament?.name ?? 'the tournament'}`,
          `<h2>${tournament?.name ?? 'Tournament'}</h2>
          <p>Your group: <strong>${group.name}</strong></p>
          ${teeTimeStr ? `<p>Tee time: <strong>${teeTimeStr}</strong></p>` : ''}
          ${group.startingHole ? `<p>Starting hole: <strong>#${group.startingHole}</strong></p>` : ''}
          <p>Playing with:</p>
          <ul>${membersHtml}</ul>
          <p><a href="${domain}/${slug}">View Tournament</a></p>`,
        )
      }

      if (player.user.smsNotifications && player.user.phone) {
        const smsBody = [
          `${tournament?.name ?? 'Tournament'} — Group: ${group.name}`,
          teeTimeStr ? `Tee time: ${teeTimeStr}` : null,
          group.startingHole ? `Starting hole: #${group.startingHole}` : null,
          `Playing with: ${memberNames.join(', ')}`,
        ].filter(Boolean).join('\n')
        await sendSMS(player.user.phone, smsBody)
      }

      await prisma.tournamentGroupMember.update({
        where: { id: member.id },
        data: { notifiedAt: now },
      })

      notified++
    }

    await prisma.tournamentGroup.update({
      where: { id: group.id },
      data: {
        lastNotifiedTeeTime: group.teeTime,
        lastNotifiedStartHole: group.startingHole,
      },
    })
  }

  revalidatePath(`/${slug}/admin/groups`)
  return { ok: true, count: notified }
}
