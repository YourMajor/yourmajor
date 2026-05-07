'use client'

import Link from 'next/link'
import { Crown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PlayerStanding, MatchStatus } from '@/lib/scoring-utils'

function getShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return parts[0]
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`
}

interface Ranked extends PlayerStanding {
  displayRank: string
}

interface Props {
  rows: Ranked[]
  slug: string
  loading: boolean
  defendingChampionPlayerId?: string | null
  /** Map of tournamentPlayerId → display name; used to resolve `opponentId`. */
  playerNames: Record<string, string>
}

function formatStatus(p: PlayerStanding): { label: string; tone: 'lead' | 'down' | 'neutral' | 'final' } {
  const status: MatchStatus | undefined = p.matchStatus
  const up = p.holesUp ?? 0
  const through = p.through ?? p.holesPlayed ?? 0
  if (!status || through === 0) return { label: '—', tone: 'neutral' }
  if (status === 'AS') return { label: 'AS', tone: 'neutral' }
  if (status === 'closed' || status === 'final') {
    if (up === 0) return { label: status === 'final' ? 'Halved' : 'AS', tone: 'neutral' }
    // Standard scoreboard form: "5&4" = 5 up with 4 to play (closed).
    if (status === 'closed') {
      const remaining = Math.max(1, 18 - through)   // approximate; v1 uses 18-cap heuristic
      const lead = Math.abs(up)
      return { label: `${lead}&${remaining}`, tone: up > 0 ? 'lead' : 'down' }
    }
    return { label: `${Math.abs(up)} UP`, tone: up > 0 ? 'lead' : 'down' }
  }
  if (status === 'dormie') return { label: `Dormie thru ${through}`, tone: up > 0 ? 'lead' : 'down' }
  // live
  const sign = up > 0 ? 'UP' : 'DOWN'
  return { label: `${Math.abs(up)} ${sign} thru ${through}`, tone: up > 0 ? 'lead' : 'down' }
}

export function MatchPlayLeaderboardTable({ rows, slug, loading, defendingChampionPlayerId, playerNames }: Props) {
  return (
    <div className="rounded-lg overflow-hidden overflow-x-auto" role="region" aria-label="Match-play leaderboard">
      <table className="masters-table">
        <caption className="sr-only">Match-play leaderboard — {rows.length} players</caption>
        <thead>
          <tr>
            <th style={{ width: '36px' }} className="px-0">POS</th>
            <th className="text-left pl-3 sm:pl-4">PLAYER</th>
            <th className="text-center" style={{ width: '14%' }} title="Wins-Losses-Halves of holes across the field">RECORD</th>
            <th className="text-center" style={{ width: '24%' }}>STATUS</th>
            <th className="hidden sm:table-cell text-center" style={{ width: '14%' }}>OPPONENT</th>
          </tr>
        </thead>
        <tbody className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {rows.map((p) => {
            const status = formatStatus(p)
            const record = p.matchRecord
            const opponentName = p.opponentId ? playerNames[p.opponentId] ?? '—' : '—'
            const toneClass =
              status.tone === 'lead' ? 'text-score-birdie font-bold'
              : status.tone === 'down' ? 'text-score-bogey font-bold'
              : 'font-semibold'
            return (
              <tr key={p.tournamentPlayerId} className="hover:bg-muted/50 transition-colors">
                <td className="text-center px-0" style={{ width: '36px' }}>
                  {p.holesPlayed === 0 ? (
                    <span className="text-muted-foreground/50 text-sm">—</span>
                  ) : (
                    <span className="text-sm font-bold">
                      {p.displayRank.startsWith('T')
                        ? <><span className="text-muted-foreground text-xs">T</span>{p.displayRank.slice(1)}</>
                        : p.displayRank}
                    </span>
                  )}
                </td>
                <td className="pl-3 sm:pl-4">
                  <Link href={`/${slug}/players/${p.tournamentPlayerId}`} className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {defendingChampionPlayerId === p.tournamentPlayerId ? (
                        <div className="rounded-full p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600">
                          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-background">
                            <AvatarImage src={p.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-xs sm:text-sm font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                              {p.playerName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      ) : (
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                          <AvatarImage src={p.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs sm:text-sm font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                            {p.playerName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {defendingChampionPlayerId === p.tournamentPlayerId && (
                        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 text-yellow-900 ring-2 ring-background">
                          <Crown className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <span className="text-sm sm:text-base font-medium text-foreground truncate">
                      {getShortName(p.playerName)}
                    </span>
                  </Link>
                </td>
                <td className="text-center text-sm">
                  {record
                    ? <span className="font-mono">{record.won}-{record.lost}-{record.halved}</span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="text-center text-xs sm:text-sm">
                  <span className={toneClass}>{status.label}</span>
                </td>
                <td className="hidden sm:table-cell text-center text-xs sm:text-sm text-muted-foreground">
                  {opponentName}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-12 text-muted-foreground">
                No matches yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
