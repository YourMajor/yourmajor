'use client'

import Link from 'next/link'
import { Crown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PlayerStanding } from '@/lib/scoring-utils'

function getShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return parts[0]
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`
}

function vsParLabel(n: number | null): string {
  if (n === null) return '—'
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : `${n}`
}

function ScoreCell({ n, bold = false }: { n: number | null; bold?: boolean }) {
  if (n === null) return <span className="text-muted-foreground">—</span>
  const label = vsParLabel(n)
  const color = n < 0 ? 'text-score-birdie' : n === 0 ? 'text-score-par' : 'text-score-bogey'
  const weight = bold ? 'font-extrabold' : 'font-semibold'
  return <span className={`${color} ${weight}`}>{label}</span>
}

interface Ranked extends PlayerStanding {
  displayRank: string
}

interface Props {
  rows: Ranked[]
  slug: string
  loading: boolean
  defendingChampionPlayerId?: string | null
}

function rankBadge(rank: number | undefined, label: 'GROSS' | 'NET') {
  if (rank === 1) {
    return (
      <span
        title={`Leading ${label.toLowerCase()} division`}
        className="inline-flex items-center gap-1 rounded-full bg-yellow-400/90 text-yellow-950 px-1.5 py-0.5 text-[10px] font-bold"
      >
        <Crown className="w-3 h-3" />
        {label}
      </span>
    )
  }
  if (!rank) return null
  return null
}

export function LowGrossNetLeaderboardTable({ rows, slug, loading, defendingChampionPlayerId }: Props) {
  return (
    <div className="rounded-lg overflow-hidden overflow-x-auto" role="region" aria-label="Low gross / low net leaderboard">
      <table className="masters-table">
        <caption className="sr-only">Low Gross / Low Net leaderboard — {rows.length} players</caption>
        <thead>
          <tr>
            <th style={{ width: '36px' }} className="px-0">POS</th>
            <th className="text-left pl-3 sm:pl-4">PLAYER</th>
            <th className="text-center" style={{ width: '12%' }}>GROSS</th>
            <th className="text-center hidden sm:table-cell" style={{ width: '8%' }}>G-RANK</th>
            <th className="text-center" style={{ width: '12%' }}>NET</th>
            <th className="text-center hidden sm:table-cell" style={{ width: '8%' }}>N-RANK</th>
            <th className="text-center" style={{ width: '8%' }}>THRU</th>
          </tr>
        </thead>
        <tbody className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {rows.map((p) => {
            const totalHoles = 18
            const thru = p.holesPlayed === 0 ? '—' : p.holesPlayed >= totalHoles ? 'F' : p.holesPlayed
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
                    </div>
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <span className="text-sm sm:text-base font-medium text-foreground truncate">
                        {getShortName(p.playerName)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {rankBadge(p.grossRank, 'GROSS')}
                        {rankBadge(p.netRank, 'NET')}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="text-center"><ScoreCell n={p.grossVsPar} bold /></td>
                <td className="text-center text-xs text-muted-foreground hidden sm:table-cell">
                  {p.grossRank ?? '—'}
                </td>
                <td className="text-center"><ScoreCell n={p.netVsPar} bold /></td>
                <td className="text-center text-xs text-muted-foreground hidden sm:table-cell">
                  {p.netRank ?? '—'}
                </td>
                <td className="text-center text-xs sm:text-sm text-muted-foreground">{thru}</td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-12 text-muted-foreground">
                No scores yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
