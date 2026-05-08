export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { TeamsAdmin } from './TeamsAdmin'

export default async function TeamsAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getUser()
  if (!user) redirect('/sign-in')

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      tournamentFormat: true,
      teamSize: true,
      teams: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          color: true,
          members: {
            select: {
              id: true,
              isCaptain: true,
              tournamentPlayer: {
                select: {
                  id: true,
                  user: {
                    select: {
                      name: true,
                      email: true,
                      image: true,
                      profile: { select: { avatar: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      players: {
        where: { isParticipant: true },
        select: {
          id: true,
          user: {
            select: {
              name: true,
              email: true,
              image: true,
              profile: { select: { avatar: true } },
            },
          },
          teamMembership: { select: { teamId: true } },
        },
      },
    },
  })
  if (!tournament) notFound()

  const isGlobalAdmin = user.role === 'ADMIN'
  if (!isGlobalAdmin) {
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
      select: { isAdmin: true },
    })
    if (!membership?.isAdmin) redirect(`/${slug}`)
  }

  const teams = tournament.teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    members: t.members.map((m) => ({
      memberRowId: m.id,
      tournamentPlayerId: m.tournamentPlayer.id,
      name: m.tournamentPlayer.user.name ?? m.tournamentPlayer.user.email.split('@')[0],
      avatarUrl: m.tournamentPlayer.user.profile?.avatar ?? m.tournamentPlayer.user.image ?? null,
      isCaptain: m.isCaptain,
    })),
  }))

  const unassigned = tournament.players
    .filter((p) => !p.teamMembership)
    .map((p) => ({
      tournamentPlayerId: p.id,
      name: p.user.name ?? p.user.email.split('@')[0],
      avatarUrl: p.user.profile?.avatar ?? p.user.image ?? null,
    }))

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Manage Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create teams, assign members, and choose a captain. Captains are informational — any teammate can record scores in team-mode formats.
        </p>
        {tournament.teamSize && (
          <p className="text-xs text-muted-foreground mt-1">
            Recommended team size: {tournament.teamSize}
          </p>
        )}
      </header>

      <TeamsAdmin
        slug={slug}
        teams={teams}
        unassignedPlayers={unassigned}
        recommendedTeamSize={tournament.teamSize ?? null}
      />
    </main>
  )
}
