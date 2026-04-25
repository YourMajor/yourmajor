'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

async function getRootTournamentId(tournamentId: string): Promise<string> {
  let currentId = tournamentId
  for (let i = 0; i < 100; i++) {
    const t = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: { id: true, parentTournamentId: true },
    })
    if (!t || !t.parentTournamentId) return currentId
    currentId = t.parentTournamentId
  }
  return currentId
}

async function requireAdmin(tournamentId: string) {
  const user = await getUser()
  if (!user) redirect('/auth/login')
  if (user.role !== 'ADMIN') {
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: user.id } },
      select: { isAdmin: true },
    })
    if (!membership?.isAdmin) throw new Error('Forbidden')
  }
  return user
}

export interface AdjustmentRow {
  id: string
  userId: string
  playerName: string
  playerAvatar: string | null
  delta: number
  reason: string
  createdAt: string
  createdBy: string
}

export async function listSeasonAdjustments(tournamentId: string): Promise<AdjustmentRow[]> {
  await requireAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)

  const rows = await prisma.seasonAdjustment.findMany({
    where: { rootTournamentId: rootId },
    orderBy: { createdAt: 'desc' },
  })

  if (rows.length === 0) return []

  const userIds = Array.from(new Set(rows.map((r) => r.userId)))
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      profile: { select: { displayName: true, avatar: true } },
    },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  return rows.map((r) => {
    const u = userMap.get(r.userId)
    return {
      id: r.id,
      userId: r.userId,
      playerName: u?.profile?.displayName ?? u?.name ?? u?.email.split('@')[0] ?? 'Unknown',
      playerAvatar: u?.profile?.avatar ?? u?.image ?? null,
      delta: r.delta,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy,
    }
  })
}

export async function addSeasonAdjustment(
  tournamentId: string,
  payload: { userId: string; delta: number; reason: string },
) {
  const user = await requireAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)

  if (!Number.isFinite(payload.delta) || payload.delta === 0) {
    throw new Error('Adjustment delta must be a non-zero number.')
  }
  const trimmedReason = payload.reason.trim()
  if (trimmedReason.length === 0) {
    throw new Error('Adjustment reason is required.')
  }

  // Verify the target user has actually played in this league chain.
  const playerExists = await prisma.tournamentPlayer.findFirst({
    where: { userId: payload.userId, tournament: { OR: [{ id: rootId }, { parentTournamentId: rootId }] } },
    select: { id: true },
  })
  if (!playerExists) {
    throw new Error('Selected player has not played any event in this league.')
  }

  await prisma.seasonAdjustment.create({
    data: {
      rootTournamentId: rootId,
      userId: payload.userId,
      delta: Math.round(payload.delta),
      reason: trimmedReason,
      createdBy: user.id,
    },
  })

  revalidatePath('/', 'layout')
}

export async function deleteSeasonAdjustment(tournamentId: string, adjustmentId: string) {
  await requireAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)

  // Confirm the adjustment belongs to this root before deleting.
  const adj = await prisma.seasonAdjustment.findUnique({
    where: { id: adjustmentId },
    select: { rootTournamentId: true },
  })
  if (!adj || adj.rootTournamentId !== rootId) return

  await prisma.seasonAdjustment.delete({ where: { id: adjustmentId } })

  revalidatePath('/', 'layout')
}
