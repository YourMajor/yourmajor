'use server'

import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireTournamentAdmin(slug: string): Promise<
  { ok: true; tournamentId: string; userId: string } | { error: string }
> {
  const user = await getUser()
  if (!user) return { error: 'Unauthorized' }
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!tournament) return { error: 'Tournament not found' }
  const isGlobalAdmin = user.role === 'ADMIN'
  if (!isGlobalAdmin) {
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
      select: { isAdmin: true },
    })
    if (!membership?.isAdmin) return { error: 'Forbidden' }
  }
  return { ok: true, tournamentId: tournament.id, userId: user.id }
}

function revalidateTeamPaths(slug: string, teamId?: string) {
  revalidatePath(`/${slug}/admin/teams`)
  revalidatePath(`/${slug}`)
  if (teamId) revalidatePath(`/${slug}/teams/${teamId}`)
}

// ── Team CRUD ────────────────────────────────────────────────────────────────

export async function createTeam(input: {
  slug: string
  name: string
  color: string | null
}): Promise<{ ok: true; teamId: string } | { error: string }> {
  const auth = await requireTournamentAdmin(input.slug)
  if ('error' in auth) return auth
  const trimmed = input.name.trim()
  if (!trimmed) return { error: 'Team name is required' }
  if (trimmed.length > 80) return { error: 'Team name is too long' }
  const team = await prisma.tournamentTeam.create({
    data: { tournamentId: auth.tournamentId, name: trimmed, color: input.color },
  })
  revalidateTeamPaths(input.slug)
  return { ok: true, teamId: team.id }
}

export async function deleteTeam(input: {
  slug: string
  teamId: string
}): Promise<{ ok: true } | { error: string }> {
  const auth = await requireTournamentAdmin(input.slug)
  if ('error' in auth) return auth
  const team = await prisma.tournamentTeam.findUnique({
    where: { id: input.teamId },
    select: { tournamentId: true },
  })
  if (!team || team.tournamentId !== auth.tournamentId) return { error: 'Team not found' }
  await prisma.tournamentTeam.delete({ where: { id: input.teamId } })
  revalidateTeamPaths(input.slug)
  return { ok: true }
}

export async function addTeamMember(input: {
  slug: string
  teamId: string
  tournamentPlayerId: string
}): Promise<{ ok: true } | { error: string }> {
  const auth = await requireTournamentAdmin(input.slug)
  if ('error' in auth) return auth
  const [team, tp] = await Promise.all([
    prisma.tournamentTeam.findUnique({
      where: { id: input.teamId },
      select: { tournamentId: true, members: { select: { id: true, isCaptain: true } } },
    }),
    prisma.tournamentPlayer.findUnique({
      where: { id: input.tournamentPlayerId },
      select: { tournamentId: true, teamMembership: { select: { teamId: true } } },
    }),
  ])
  if (!team || team.tournamentId !== auth.tournamentId) return { error: 'Team not found' }
  if (!tp || tp.tournamentId !== auth.tournamentId) return { error: 'Player not in this tournament' }
  if (tp.teamMembership) return { error: 'Player is already on a team — remove them first' }

  // First-added member becomes captain by default; admins can reassign later.
  const isFirstMember = team.members.length === 0
  await prisma.tournamentTeamMember.create({
    data: {
      teamId: input.teamId,
      tournamentPlayerId: input.tournamentPlayerId,
      isCaptain: isFirstMember,
    },
  })
  revalidateTeamPaths(input.slug, input.teamId)
  return { ok: true }
}

export async function removeTeamMember(input: {
  slug: string
  memberRowId: string
}): Promise<{ ok: true } | { error: string }> {
  const auth = await requireTournamentAdmin(input.slug)
  if ('error' in auth) return auth
  const member = await prisma.tournamentTeamMember.findUnique({
    where: { id: input.memberRowId },
    select: {
      isCaptain: true,
      teamId: true,
      team: { select: { tournamentId: true, members: { select: { id: true } } } },
    },
  })
  if (!member || member.team.tournamentId !== auth.tournamentId) {
    return { error: 'Member not found' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.tournamentTeamMember.delete({ where: { id: input.memberRowId } })
    // If we just removed the captain and other members remain, promote the
    // first remaining member so the team always has exactly one captain.
    if (member.isCaptain) {
      const remaining = await tx.tournamentTeamMember.findMany({
        where: { teamId: member.teamId },
        orderBy: { id: 'asc' },
        select: { id: true },
        take: 1,
      })
      if (remaining[0]) {
        await tx.tournamentTeamMember.update({
          where: { id: remaining[0].id },
          data: { isCaptain: true },
        })
      }
    }
  })

  revalidateTeamPaths(input.slug, member.teamId)
  return { ok: true }
}

// ── Captain reassignment ─────────────────────────────────────────────────────

/**
 * Reassign the captain badge for a team. Captain is informational only — any
 * team member may submit team-mode scores regardless of who holds the badge.
 *
 * Auth: tournament admin or global admin only.
 */
export async function setTeamCaptain(input: {
  slug: string
  teamId: string
  newCaptainPlayerId: string
}): Promise<{ ok: true } | { error: string }> {
  const user = await getUser()
  if (!user) return { error: 'Unauthorized' }

  const team = await prisma.tournamentTeam.findUnique({
    where: { id: input.teamId },
    select: {
      tournamentId: true,
      tournament: { select: { slug: true } },
      members: { select: { id: true, tournamentPlayerId: true } },
    },
  })
  if (!team) return { error: 'Team not found' }
  if (team.tournament.slug !== input.slug) return { error: 'Team does not belong to this tournament' }

  const isGlobalAdmin = user.role === 'ADMIN'
  if (!isGlobalAdmin) {
    const adminMembership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: team.tournamentId, userId: user.id } },
      select: { isAdmin: true },
    })
    if (!adminMembership?.isAdmin) return { error: 'Forbidden' }
  }

  const target = team.members.find((m) => m.tournamentPlayerId === input.newCaptainPlayerId)
  if (!target) return { error: 'Player is not on this team' }

  await prisma.$transaction([
    prisma.tournamentTeamMember.updateMany({
      where: { teamId: input.teamId, isCaptain: true },
      data: { isCaptain: false },
    }),
    prisma.tournamentTeamMember.update({
      where: { id: target.id },
      data: { isCaptain: true },
    }),
  ])

  revalidatePath(`/${input.slug}/admin/teams`)
  revalidatePath(`/${input.slug}/teams/${input.teamId}`)
  revalidatePath(`/${input.slug}`)
  return { ok: true }
}
