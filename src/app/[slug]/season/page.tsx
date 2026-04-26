export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getTournamentTier } from '@/lib/stripe'
import { getSeasonStandings, getSeasonAwards } from '@/lib/season-standings'
import { getLatestEventRecap } from '@/lib/season-recap'
import { getLeagueEvents, getLeagueRootId } from '@/lib/league-events'
import { TIER_LIMITS } from '@/lib/tiers'
import { SeasonDashboard } from '@/components/season/SeasonDashboard'
import { SponsorStrip } from '@/components/hub/SponsorStrip'
import type { ScheduleEvent } from '@/components/season/LeagueScheduleView'

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, parentTournamentId: true, isLeague: true },
  })
  if (!tournament) return null

  // Show season page for leagues, tournaments in a chain, or CLUB/LEAGUE tier
  const hasChain = !!tournament.parentTournamentId
  const isLeague = tournament.isLeague
  const tier = await getTournamentTier(tournament.id)
  const hasTierAccess = tier === 'CLUB' || tier === 'LEAGUE'

  if (!hasChain && !isLeague && !hasTierAccess) {
    // Check if root has season scoring configured
    let seasonConfigured = false
    const root = await prisma.tournament.findFirst({
      where: { id: tournament.id, seasonScoringMethod: { not: null } },
    })
    seasonConfigured = !!root

    if (!seasonConfigured) {
      return (
        <main className="max-w-3xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Season Standings</h1>
          <p className="text-muted-foreground">
            Season standings are available for leagues with multiple linked events.
            Renew your tournament to start building a season history.
          </p>
        </main>
      )
    }
  }

  const [seasonData, awards, recap, user] = await Promise.all([
    getSeasonStandings(tournament.id),
    getSeasonAwards(tournament.id),
    getLatestEventRecap(tournament.id),
    getUser(),
  ])

  // Build the per-event schedule view if this is a league chain.
  let scheduleEvents: ScheduleEvent[] = []
  let onRoster = false
  if (tournament.isLeague || tournament.parentTournamentId) {
    const leagueEvents = await getLeagueEvents(tournament.id)
    if (leagueEvents.length > 0) {
      // Pull current user's TournamentPlayer + score counts for each event in one query.
      let myPlayers: Array<{
        tournamentId: string
        id: string
        isParticipant: boolean
        _count: { scores: number }
      }> = []
      if (user) {
        myPlayers = await prisma.tournamentPlayer.findMany({
          where: {
            userId: user.id,
            tournamentId: { in: leagueEvents.map((e) => e.id) },
          },
          select: {
            id: true,
            tournamentId: true,
            isParticipant: true,
            _count: { select: { scores: true } },
          },
        })

        // Roster lookup — does the user belong to the league roster?
        const rootId = await getLeagueRootId(tournament.id)
        if (rootId) {
          const rosterMember = await prisma.leagueRosterMember.findFirst({
            where: {
              userId: user.id,
              roster: { rootTournamentId: rootId },
              status: 'ACTIVE',
            },
            select: { id: true },
          })
          onRoster = !!rosterMember
        }
      }

      const playerByEvent = new Map(myPlayers.map((p) => [p.tournamentId, p]))
      scheduleEvents = leagueEvents.map((e) => {
        const player = playerByEvent.get(e.id)
        return {
          id: e.id,
          slug: e.slug,
          name: e.name,
          date: e.date?.toISOString() ?? null,
          status: e.status,
          myParticipation: player ? player.isParticipant : null,
          hasScores: (player?._count.scores ?? 0) > 0,
        }
      })
    }
  }

  const showHistoryLink = TIER_LIMITS[tier].seasonOverSeasonTracking

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <SponsorStrip tournamentId={tournament.id} />
      {showHistoryLink && (
        <div className="mb-4 flex justify-end">
          <Link
            href={`/${slug}/season/history`}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Season History →
          </Link>
        </div>
      )}
      <SeasonDashboard
        standings={seasonData.standings}
        events={seasonData.events}
        scoringMethod={seasonData.scoringMethod}
        seasonName={seasonData.seasonName}
        awards={awards}
        recap={recap}
        slug={slug}
        scheduleEvents={scheduleEvents}
        isAuthenticated={!!user}
        onRoster={onRoster}
      />
    </main>
  )
}
