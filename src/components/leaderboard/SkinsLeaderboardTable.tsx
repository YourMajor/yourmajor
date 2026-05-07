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
  /** Active carryover badge (skins waiting to be claimed on the next hole). */
  trailingCarryover: number
  showValueColumn: boolean
}

export function SkinsLeaderboardTable({ rows, slug, loading, defendingChampionPlayerId, trailingCarryover, showValueColumn }: Props) {
  return (
    <div className="space-y-3">
      {trailingCarryover > 0 && (
        <div
          role="status"
          className="inline-flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Carryover: {trailingCarryover} skin{trailingCarryover === 1 ? '' : 's'} on the next hole
        </div>
      )}

      <div className="rounded-lg overflow-hidden overflow-x-auto" role="region" aria-label="Skins leaderboard">
        <table className="masters-table">
          <caption className="sr-only">Skins leaderboard — {rows.length} players</caption>
          <thead>
            <tr>
              <th style={{ width: '36px' }} className="px-0">POS</th>
              <th className="text-left pl-3 sm:pl-4">PLAYER</th>
              <th className="text-center" style={{ width: '14%' }}>SKINS</th>
              {showValueColumn && (
                <th className="text-center" style={{ width: '14%' }}>VALUE</th>
              )}
              <th className="hidden sm:table-cell text-center" style={{ width: '14%' }}>HOLES</th>
              <th className="hidden lg:table-cell text-center" style={{ width: '10%' }}>THRU</th>
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {rows.map((p) => {
              const won = p.skinsWon ?? 0
              const value = p.skinsValue ?? 1
              const totalValue = won * value
              const holesList = p.skinsHoles ?? []
              const holesPreview = holesList.length === 0
                ? '—'
                : holesList
                    .slice(0, 3)
                    .map((h) => h.carryover > 1 ? `${h.hole}(×${h.carryover})` : `${h.hole}`)
                    .join(', ') + (holesList.length > 3 ? ` +${holesList.length - 3}` : '')
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
                  <td className="text-center text-sm font-bold">{won}</td>
                  {showValueColumn && (
                    <td className="text-center text-sm text-muted-foreground">
                      {won > 0 ? `$${totalValue}` : '—'}
                    </td>
                  )}
                  <td
                    className="hidden sm:table-cell text-center text-xs text-muted-foreground font-mono"
                    title={holesList.length > 0
                      ? holesList.map((h) => `R${h.round} H${h.hole}: ${h.carryover} skin${h.carryover === 1 ? '' : 's'}`).join('\n')
                      : 'No skins yet'}
                  >
                    {holesPreview}
                  </td>
                  <td className="hidden lg:table-cell text-center text-xs sm:text-sm text-muted-foreground">
                    {p.holesPlayed > 0 ? p.holesPlayed : '—'}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showValueColumn ? 6 : 5} className="text-center py-12 text-muted-foreground">
                  No skins claimed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
