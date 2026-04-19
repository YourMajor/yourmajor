'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trophy, TrendingUp, TrendingDown, Minus, Crown, Calendar } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { SeasonPlayerSummary, SeasonEvent, SeasonAward } from '@/lib/season-standings'
import type { EventRecap } from '@/lib/season-recap'
import type { SeasonScoringMethod } from '@/generated/prisma/client'

interface SeasonDashboardProps {
  standings: SeasonPlayerSummary[]
  events: SeasonEvent[]
  scoringMethod: SeasonScoringMethod
  seasonName: string
  awards: SeasonAward[]
  recap: EventRecap | null
  slug: string
}

function formatValue(value: number, method: SeasonScoringMethod): string {
  if (method === 'STROKE_AVG' || method === 'BEST_OF_N') {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}`
  }
  return String(Math.round(value))
}

function valueLabel(method: SeasonScoringMethod): string {
  switch (method) {
    case 'POINTS': return 'Pts'
    case 'STROKE_AVG': return 'Avg'
    case 'BEST_OF_N': return 'Avg'
    case 'STABLEFORD_CUMULATIVE': return 'Pts'
    default: return 'Pts'
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function TrendIndicator({ trend }: { trend: number | null }) {
  if (trend === null) return <Badge variant="outline" className="text-[10px]">NEW</Badge>
  if (trend > 0) return <span className="flex items-center gap-0.5 text-green-600 text-xs font-semibold"><TrendingUp className="w-3 h-3" />{trend}</span>
  if (trend < 0) return <span className="flex items-center gap-0.5 text-red-500 text-xs font-semibold"><TrendingDown className="w-3 h-3" />{Math.abs(trend)}</span>
  return <span className="text-muted-foreground"><Minus className="w-3 h-3" /></span>
}

export function SeasonDashboard({ standings, events, scoringMethod, seasonName, awards, recap, slug }: SeasonDashboardProps) {
  const completedEvents = events.filter((e) => e.status === 'COMPLETED' || e.status === 'ACTIVE')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Trophy className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-foreground">
            Season Standings
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {seasonName} &middot; {completedEvents.length} event{completedEvents.length !== 1 ? 's' : ''} played
        </p>
      </div>

      {/* Latest event recap card */}
      {recap && <RecapCard recap={recap} />}

      <Tabs defaultValue="standings">
        <TabsList variant="line">
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          {awards.length > 0 && <TabsTrigger value="awards">Awards</TabsTrigger>}
        </TabsList>

        <TabsContent value="standings">
          <StandingsTable standings={standings} scoringMethod={scoringMethod} slug={slug} />
        </TabsContent>

        <TabsContent value="events">
          <EventsList events={events} />
        </TabsContent>

        {awards.length > 0 && (
          <TabsContent value="awards">
            <AwardsList awards={awards} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// ─── Standings Table ─────────────────────────────────────────────────────────

function StandingsTable({
  standings,
  scoringMethod,
  slug,
}: {
  standings: SeasonPlayerSummary[]
  scoringMethod: SeasonScoringMethod
  slug: string
}) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  if (standings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No results yet. Complete an event to see season standings.
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-1">
      {/* Header */}
      <div className="grid grid-cols-[2.5rem_1fr_3rem_4rem_3rem] sm:grid-cols-[3rem_1fr_4rem_5rem_4rem] items-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Pos</span>
        <span>Player</span>
        <span className="text-center">Evts</span>
        <span className="text-right">{valueLabel(scoringMethod)}</span>
        <span className="text-center">Trend</span>
      </div>

      {standings.map((player) => {
        const isExpanded = expandedPlayer === player.userId
        const isLeader = player.rank === 1

        return (
          <div key={player.userId}>
            <button
              onClick={() => setExpandedPlayer(isExpanded ? null : player.userId)}
              className={`w-full grid grid-cols-[2.5rem_1fr_3rem_4rem_3rem] sm:grid-cols-[3rem_1fr_4rem_5rem_4rem] items-center px-3 py-3 rounded-lg transition-colors text-left ${
                isLeader
                  ? 'bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20'
                  : 'hover:bg-muted/50'
              } ${isExpanded ? 'bg-muted/50' : ''}`}
            >
              {/* Rank */}
              <span className="text-sm font-bold text-foreground flex items-center gap-1">
                {isLeader && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                {!isLeader && player.rank}
              </span>

              {/* Player */}
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar size="sm">
                  <AvatarImage src={player.avatarUrl ?? undefined} alt={player.playerName} />
                  <AvatarFallback>{getInitials(player.playerName)}</AvatarFallback>
                </Avatar>
                <Link
                  href={`/${slug}/season/player?userId=${player.userId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-medium text-foreground truncate hover:underline"
                >
                  {player.playerName}
                </Link>
              </div>

              {/* Events */}
              <span className="text-sm text-center text-muted-foreground">
                {player.eventsPlayed}
              </span>

              {/* Value */}
              <span className="text-sm font-bold text-right text-foreground">
                {formatValue(player.value, scoringMethod)}
              </span>

              {/* Trend */}
              <span className="flex items-center justify-center">
                <TrendIndicator trend={player.trend} />
              </span>
            </button>

            {/* Expanded: per-event results */}
            {isExpanded && (
              <div className="mx-3 mb-2 mt-1 rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground grid grid-cols-[1fr_4rem_4rem]">
                  <span>Event</span>
                  <span className="text-center">Finish</span>
                  <span className="text-right">Score</span>
                </div>
                {player.eventResults.map((r) => (
                  <Link
                    key={r.tournamentId}
                    href={`/${r.tournamentSlug}`}
                    className="px-3 py-2 grid grid-cols-[1fr_4rem_4rem] items-center text-sm hover:bg-muted/30 transition-colors border-t border-border/50"
                  >
                    <div className="min-w-0">
                      <span className="truncate block text-foreground">{r.tournamentName}</span>
                      {r.date && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <span className="text-center font-semibold">
                      {ordinal(r.rank)}
                    </span>
                    <span className="text-right text-muted-foreground">
                      {r.netVsPar !== null
                        ? `${r.netVsPar > 0 ? '+' : ''}${r.netVsPar}`
                        : r.grossVsPar !== null
                          ? `${r.grossVsPar > 0 ? '+' : ''}${r.grossVsPar}`
                          : r.points !== null
                            ? `${r.points} pts`
                            : '-'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Events List ─────────────────────────────────────────────────────────────

function EventsList({ events }: { events: SeasonEvent[] }) {
  const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    REGISTRATION: { label: 'Upcoming', variant: 'outline' },
    ACTIVE: { label: 'Live', variant: 'default' },
    COMPLETED: { label: 'Complete', variant: 'secondary' },
  }

  return (
    <div className="mt-4 space-y-2">
      {events.length === 0 && (
        <p className="text-center py-8 text-muted-foreground">No events in this season yet.</p>
      )}
      {events.map((event) => {
        const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.REGISTRATION
        return (
          <Link
            key={event.tournamentId}
            href={`/${event.slug}`}
            className="flex items-center justify-between gap-4 rounded-xl border border-border px-5 py-4 transition-all hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{event.name}</p>
              {event.date && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </Link>
        )
      })}
    </div>
  )
}

// ─── Awards ──────────────────────────────────────────────────────────────────

function AwardsList({ awards }: { awards: SeasonAward[] }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {awards.map((award) => (
        <div key={award.title} className="rounded-xl border border-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{award.title}</p>
          <div className="flex items-center gap-3 mb-2">
            <Avatar size="sm">
              <AvatarImage src={award.playerAvatar ?? undefined} alt={award.playerName} />
              <AvatarFallback>{getInitials(award.playerName)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold text-foreground">{award.playerName}</span>
          </div>
          <p className="text-xs text-muted-foreground">{award.description}</p>
          <p className="text-lg font-bold text-foreground mt-1">{award.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Recap Card ──────────────────────────────────────────────────────────────

function RecapCard({ recap }: { recap: EventRecap }) {
  return (
    <Link
      href={`/${recap.tournamentSlug}`}
      className="block rounded-xl border border-border p-5 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-all"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Latest Result</p>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{recap.tournamentName}</p>
          {recap.date && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(recap.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarImage src={recap.winner.avatarUrl ?? undefined} />
            <AvatarFallback>{getInitials(recap.winner.name)}</AvatarFallback>
          </Avatar>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{recap.winner.name}</p>
            {recap.winner.grossVsPar !== null && (
              <p className="text-xs text-muted-foreground">
                {recap.winner.grossVsPar === 0 ? 'E' : recap.winner.grossVsPar > 0 ? `+${recap.winner.grossVsPar}` : recap.winner.grossVsPar}
              </p>
            )}
          </div>
        </div>
      </div>
      {recap.highlights.length > 0 && (
        <div className="flex gap-3 mt-3 pt-3 border-t border-border/50">
          {recap.highlights.map((h) => (
            <div key={h.type} className="flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{h.label}</p>
              <p className="text-xs font-medium text-foreground">{h.playerName}</p>
              <p className="text-[10px] text-muted-foreground">{h.value}</p>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
