import { prisma } from '@/lib/prisma'
import { GroupBuilder } from '@/components/admin/GroupBuilder'

export default async function AdminGroupsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      isLeague: true,
      parentTournamentId: true,
      players: {
        where: { isParticipant: true },
        include: {
          user: { select: { name: true, email: true } },
          groupMembership: { select: { groupId: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      groups: {
        include: {
          members: {
            include: {
              tournamentPlayer: {
                include: { user: { select: { name: true, email: true } } },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!tournament) return null

  const players = tournament.players.map((p) => ({
    id: p.id,
    name: p.user.name ?? p.user.email,
    email: p.user.email,
    handicap: p.handicap,
    groupId: p.groupMembership?.groupId ?? null,
  }))

  const groups = tournament.groups.map((g) => ({
    id: g.id,
    name: g.name,
    teeTime: g.teeTime?.toISOString() ?? null,
    startingHole: g.startingHole,
    lastNotifiedTeeTime: g.lastNotifiedTeeTime?.toISOString() ?? null,
    lastNotifiedStartHole: g.lastNotifiedStartHole,
    members: g.members.map((m) => ({
      tournamentPlayerId: m.tournamentPlayerId,
      name: m.tournamentPlayer.user.name ?? m.tournamentPlayer.user.email,
      position: m.position,
      notifiedAt: m.notifiedAt?.toISOString() ?? null,
    })),
  }))

  const openVacancies = await prisma.groupVacancy.findMany({
    where: { tournamentId: tournament.id, dismissedAt: null },
    orderBy: { unregisteredAt: 'desc' },
  })

  const vacancies = openVacancies.map((v) => ({
    id: v.id,
    groupName: v.groupName,
    teeTime: v.teeTime?.toISOString() ?? null,
    startingHole: v.startingHole,
    playerName: v.playerName,
    unregisteredAt: v.unregisteredAt.toISOString(),
  }))

  return (
    <main>
      <GroupBuilder
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        slug={slug}
        isLeague={tournament.isLeague || !!tournament.parentTournamentId}
        initialPlayers={players}
        initialGroups={groups}
        initialVacancies={vacancies}
      />
    </main>
  )
}
