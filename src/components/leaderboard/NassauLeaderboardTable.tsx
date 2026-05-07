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

interface Ranked extends PlayerStanding {
  displayRank: string
}

interface Props {
  rows: Ranked[]
  slug: string
  loading: boolean
  defendingChampionPlayerId?: string | null
}

function subMatchLabel(holesUp: number, thru: number, totalHoles: number): { label: string; tone: 'lead' | 'down' | 'neutral' } {
  if (thru === 0) return { label: '—', tone: 'neutral' }
  const remaining = totalHoles - thru
  if (Math.abs(holesUp) > remaining) {
    return { label: `${Math.abs(holesUp)}&${Math.max(1, remaining)}`, tone: holesUp > 0 ? 'lead' : 'down' }
  }
  if (holesUp === 0 && thru === totalHoles) return { label: 'Halved', tone: 'neutral' }
  if (holesUp === 0) return { label: `AS thru ${thru}`, tone: 'neutral' }
  if (Math.abs(holesUp) === remaining && remaining > 0) {
    return { label: `Dormie thru ${thru}`, tone: holesUp > 0 ? 'lead' : 'down' }
  }
  const sign = holesUp > 0 ? 'UP' : 'DOWN'
  return { label: `${Math.abs(holesUp)} ${sign} thru ${thru}`, tone: holesUp > 0 ? 'lead' : 'down' }
}

function CellTone({ tone, children }: { tone: 'lead' | 'down' | 'neutral'; children: React.ReactNode }) {
  const cls =
    tone === 'lead' ? 'text-score-birdie font-bold'
    : tone === 'down' ? 'text-score-bogey font-bold'
    : 'font-semibold'
  return <span className={cls}>{children}</span>
}

export function NassauLeaderboardTable({ rows, slug, loading, defendingChampionPlayerId }: Props) {
  return (
    <div className="rounded-lg overflow-hidden overflow-x-auto" role="region" aria-label="Nassau leaderboard">
      <table className="masters-table">
        <caption className="sr-only">Nassau leaderboard — {rows.length} players</caption>
        <thead>
          <tr>
            <th style={{ width: '36px' }} className="px-0">POS</th>
            <th className="text-left pl-3 sm:pl-4">PLAYER</th>
            <th className="text-center" style={{ width: '20%' }}>FRONT</th>
            <th className="text-center" style={{ width: '20%' }}>BACK</th>
            <th className="text-center" style={{ width: '20%' }}>OVERALL</th>
          </tr>
        </thead>
        <tbody className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {rows.map((p) => {
            const front = p.front ?? { holesUp: 0, thru: 0 }
            const back = p.back ?? { holesUp: 0, thru: 0 }
            const overall = p.overall ?? { holesUp: 0, thru: 0 }
            const fl = subMatchLabel(front.holesUp, front.thru, 9)
            const bl = subMatchLabel(back.holesUp, back.thru, 9)
            const ol = subMatchLabel(overall.holesUp, overall.thru, 18)
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
                <td className="text-center text-xs sm:text-sm"><CellTone tone={fl.tone}>{fl.label}</CellTone></td>
                <td className="text-center text-xs sm:text-sm"><CellTone tone={bl.tone}>{bl.label}</CellTone></td>
                <td className="text-center text-xs sm:text-sm"><CellTone tone={ol.tone}>{ol.label}</CellTone></td>
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
