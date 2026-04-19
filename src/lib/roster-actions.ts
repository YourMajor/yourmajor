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

export async function getOrCreateRoster(tournamentId: string) {
  const rootId = await getRootTournamentId(tournamentId)

  let roster = await prisma.leagueRoster.findUnique({
    where: { rootTournamentId: rootId },
    include: {
      members: {
        include: {
          user: {
            include: { profile: { select: { avatar: true, displayName: true, handicap: true } } },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  if (!roster) {
    // Auto-create roster from all players who have participated in any tournament in the chain
    roster = await prisma.leagueRoster.create({
      data: {
        rootTournamentId: rootId,
        autoAddNew: true,
      },
      include: {
        members: {
          include: {
            user: {
              include: { profile: { select: { avatar: true, displayName: true, handicap: true } } },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    })

    // Seed roster with all unique players from the chain
    const allTournamentIds = await getAllChainIds(rootId)
    const players = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: { in: allTournamentIds } },
      select: { userId: true },
      distinct: ['userId'],
    })

    if (players.length > 0) {
      await prisma.leagueRosterMember.createMany({
        data: players.map((p) => ({
          rosterId: roster!.id,
          userId: p.userId,
        })),
        skipDuplicates: true,
      })

      // Re-fetch with members
      roster = await prisma.leagueRoster.findUnique({
        where: { id: roster.id },
        include: {
          members: {
            include: {
              user: {
                include: { profile: { select: { avatar: true, displayName: true, handicap: true } } },
              },
            },
            orderBy: { joinedAt: 'asc' },
          },
        },
      })
    }
  }

  return roster
}

async function getAllChainIds(rootId: string): Promise<string[]> {
  const ids = [rootId]
  let currentSearch = [rootId]
  for (let i = 0; i < 100; i++) {
    const children = await prisma.tournament.findMany({
      where: { parentTournamentId: { in: currentSearch } },
      select: { id: true },
    })
    if (children.length === 0) break
    const childIds = children.map((c) => c.id)
    ids.push(...childIds)
    currentSearch = childIds
  }
  return ids
}

export async function addRosterMember(tournamentId: string, email: string) {
  await requireAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) throw new Error(`No user found with email ${email}`)

  const roster = await prisma.leagueRoster.findUnique({ where: { rootTournamentId: rootId } })
  if (!roster) throw new Error('Roster not found')

  await prisma.leagueRosterMember.upsert({
    where: { rosterId_userId: { rosterId: roster.id, userId: user.id } },
    create: { rosterId: roster.id, userId: user.id },
    update: { status: 'ACTIVE' },
  })

  revalidatePath('/', 'layout')
}

export async function updateRosterMemberStatus(
  tournamentId: string,
  memberId: string,
  status: 'ACTIVE' | 'INACTIVE'
) {
  await requireAdmin(tournamentId)

  await prisma.leagueRosterMember.update({
    where: { id: memberId },
    data: { status },
  })

  revalidatePath('/', 'layout')
}

export async function removeRosterMember(tournamentId: string, memberId: string) {
  await requireAdmin(tournamentId)

  await prisma.leagueRosterMember.delete({ where: { id: memberId } })

  revalidatePath('/', 'layout')
}

export async function toggleAutoAddNew(tournamentId: string, autoAddNew: boolean) {
  await requireAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)

  await prisma.leagueRoster.update({
    where: { rootTournamentId: rootId },
    data: { autoAddNew },
  })

  revalidatePath('/', 'layout')
}

export async function updateSeasonConfig(
  tournamentId: string,
  config: {
    seasonScoringMethod: string
    seasonBestOf: number | null
    seasonPointsTable: Record<number, number> | null
  }
) {
  await requireAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)

  await prisma.tournament.update({
    where: { id: rootId },
    data: {
      seasonScoringMethod: config.seasonScoringMethod as 'POINTS' | 'STROKE_AVG' | 'BEST_OF_N' | 'STABLEFORD_CUMULATIVE',
      seasonBestOf: config.seasonBestOf,
      seasonPointsTable: config.seasonPointsTable ?? undefined,
    },
  })

  revalidatePath('/', 'layout')
}
