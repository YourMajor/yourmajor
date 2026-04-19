'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trophy, Target, Users, TrendingUp, Award, ChevronLeft } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { PlayerSeasonStats } from '@/lib/season-standings'

interface PlayerSeasonHubProps {
  stats: PlayerSeasonStats
  slug: string
  isOwnProfile: boolean
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function PlayerSeasonHub({ stats, slug, isOwnProfile }: PlayerSeasonHubProps) {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/${slug}/season`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Season Standings
      </Link>

      {/* Player header */}
      <div className="flex items-center gap-4">
        <Avatar size="lg">
          <AvatarImage src={stats.avatarUrl ?? undefined} alt={stats.playerName} />
          <AvatarFallback>{getInitials(stats.playerName)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">{stats.playerName}</h1>
          <p className="text-sm text-muted-foreground">
            Season Rank: <span className="font-semibold text-foreground">{ordinal(stats.seasonRank)}</span>
            {' '}&middot;{' '}
            {stats.eventsPlayed}/{stats.totalEvents} events
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Best Finish" value={ordinal(stats.bestFinish)} />
        <StatCard label="Avg Finish" value={ordinal(Math.round(stats.avgFinish))} />
        <StatCard label="Birdies" value={String(stats.totalBirdies)} />
        <StatCard label="Eagles" value={String(stats.totalEagles)} />
      </div>

      {stats.fairwayPct !== null && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Fairway %" value={`${stats.fairwayPct.toFixed(0)}%`} />
          <StatCard label="GIR %" value={stats.girPct !== null ? `${stats.girPct.toFixed(0)}%` : '-'} />
          <StatCard label="Avg Putts" value={stats.avgPutts !== null ? stats.avgPutts.toFixed(1) : '-'} />
        </div>
      )}

      <Tabs defaultValue="results">
        <TabsList variant="line">
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="h2h">Head-to-Head</TabsTrigger>
          <TabsTrigger value="bests">Personal Bests</TabsTrigger>
          {stats.handicapHistory.length > 1 && <TabsTrigger value="handicap">Handicap</TabsTrigger>}
        </TabsList>

        <TabsContent value="results">
          <ResultsTab stats={stats} />
        </TabsContent>

        <TabsContent value="h2h">
          <HeadToHeadTab stats={stats} slug={slug} />
        </TabsContent>

        <TabsContent value="bests">
          <PersonalBestsTab stats={stats} />
        </TabsContent>

        {stats.handicapHistory.length > 1 && (
          <TabsContent value="handicap">
            <HandicapTab stats={stats} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
    </div>
  )
}

// ─── Results Tab ─────────────────────────────────────────────────────────────

function ResultsTab({ stats }: { stats: PlayerSeasonStats }) {
  return (
    <div className="mt-4 space-y-1">
      {stats.eventResults.map((r) => (
        <Link
          key={r.tournamentId}
          href={`/${r.tournamentSlug}`}
          className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg hover:bg-muted/30 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{r.tournamentName}</p>
            {r.date && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {r.grossVsPar !== null
                ? `${r.grossVsPar > 0 ? '+' : ''}${r.grossVsPar}`
                : r.points !== null
                  ? `${r.points} pts`
                  : '-'}
            </span>
            <Badge variant={r.rank <= 3 ? 'default' : 'outline'}>
              {ordinal(r.rank)}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Head-to-Head Tab ────────────────────────────────────────────────────────

function HeadToHeadTab({ stats, slug }: { stats: PlayerSeasonStats; slug: string }) {
  if (stats.headToHead.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No head-to-head data yet.</p>
  }

  return (
    <div className="mt-4 space-y-1">
      {stats.headToHead.slice(0, 20).map((h2h) => {
        const total = h2h.wins + h2h.losses + h2h.ties
        const winPct = total > 0 ? Math.round((h2h.wins / total) * 100) : 0

        return (
          <Link
            key={h2h.opponentUserId}
            href={`/${slug}/season/player?userId=${h2h.opponentUserId}`}
            className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar size="sm">
                <AvatarImage src={h2h.opponentAvatar ?? undefined} />
                <AvatarFallback>{getInitials(h2h.opponentName)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground truncate">{h2h.opponentName}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">
                <span className="text-green-600 font-semibold">{h2h.wins}W</span>
                {' - '}
                <span className="text-red-500 font-semibold">{h2h.losses}L</span>
                {h2h.ties > 0 && <span className="text-muted-foreground"> - {h2h.ties}T</span>}
              </span>
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${winPct}%` }}
                />
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ─── Personal Bests Tab ──────────────────────────────────────────────────────

function PersonalBestsTab({ stats }: { stats: PlayerSeasonStats }) {
  if (stats.personalBests.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No personal bests recorded yet.</p>
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {stats.personalBests.map((pb) => (
        <div key={pb.label} className="rounded-xl border border-border p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{pb.label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{pb.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{pb.eventName}</p>
          {pb.date && (
            <p className="text-[10px] text-muted-foreground">
              {new Date(pb.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      ))}

      {/* Score distribution */}
      <div className="rounded-xl border border-border p-5 sm:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Season Score Distribution</p>
        <div className="flex items-end gap-1 h-20">
          {[
            { label: 'Eagles', count: stats.totalEagles, color: 'bg-yellow-500' },
            { label: 'Birdies', count: stats.totalBirdies, color: 'bg-green-500' },
            { label: 'Pars', count: stats.totalPars, color: 'bg-blue-500' },
            { label: 'Bogeys', count: stats.totalBogeys, color: 'bg-orange-400' },
            { label: 'Doubles+', count: stats.totalDoubles, color: 'bg-red-500' },
          ].map((item) => {
            const total = stats.totalEagles + stats.totalBirdies + stats.totalPars + stats.totalBogeys + stats.totalDoubles
            const pct = total > 0 ? (item.count / total) * 100 : 0
            return (
              <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full rounded-t ${item.color}`} style={{ height: `${Math.max(pct, 2)}%` }} />
                <span className="text-[9px] text-muted-foreground">{item.label}</span>
                <span className="text-[10px] font-semibold text-foreground">{item.count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Handicap Tab ────────────────────────────────────────────────────────────

function HandicapTab({ stats }: { stats: PlayerSeasonStats }) {
  const history = stats.handicapHistory
  if (history.length < 2) {
    return <p className="py-8 text-center text-muted-foreground">Not enough data for handicap trend.</p>
  }

  const min = Math.min(...history.map((h) => h.handicap))
  const max = Math.max(...history.map((h) => h.handicap))
  const range = max - min || 1
  const change = history[history.length - 1].handicap - history[0].handicap

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Handicap Progression</p>
          <p className="text-xs text-muted-foreground">
            {history[0].handicap.toFixed(1)} &rarr; {history[history.length - 1].handicap.toFixed(1)}
            {' '}
            <span className={change < 0 ? 'text-green-600' : change > 0 ? 'text-red-500' : 'text-muted-foreground'}>
              ({change > 0 ? '+' : ''}{change.toFixed(1)})
            </span>
          </p>
        </div>
      </div>

      {/* Simple text-based progression */}
      <div className="space-y-1">
        {history.map((h, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-muted/30">
            <span className="text-xs text-muted-foreground w-24 truncate">{h.eventName}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-primary)]"
                style={{ width: `${((h.handicap - min) / range) * 100}%`, minWidth: '4px' }}
              />
            </div>
            <span className="text-sm font-semibold text-foreground w-10 text-right">{h.handicap.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
