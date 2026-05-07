'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PlayerStanding } from '@/lib/scoring-utils'

interface Ranked extends PlayerStanding {
  displayRank: string
}

interface Props {
  rows: Ranked[]
  slug: string
  loading: boolean
  roundNumbers: number[]
  /** True for best-ball / team-stroke when the leaderboard should show NET column too. */
  hasNet: boolean
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

export function TeamLeaderboardTable({ rows, slug, loading, roundNumbers, hasNet }: Props) {
  return (
    <div className="rounded-lg overflow-hidden overflow-x-auto" role="region" aria-label="Team leaderboard">
      <table className="masters-table">
        <caption className="sr-only">Team leaderboard — {rows.length} teams</caption>
        <thead>
          <tr>
            <th style={{ width: '36px' }} className="px-0">POS</th>
            <th className="text-left pl-3 sm:pl-4">TEAM</th>
            <th style={{ width: '10%' }}>TOTAL</th>
            <th style={{ width: '8%' }}>THRU</th>
            {roundNumbers.map((r) => (
              <th key={r} className="hidden lg:table-cell" style={{ width: '7%' }}>R{r}</th>
            ))}
            {hasNet && <th className="hidden sm:table-cell" style={{ width: '10%' }}>NET</th>}
          </tr>
        </thead>
        <tbody className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {rows.map((p) => {
            const teamId = p.teamId ?? p.tournamentPlayerId
            const teamMembers = p.teamMembers ?? []
            const visibleMembers = teamMembers.slice(0, 4)
            const overflow = teamMembers.length - visibleMembers.length
            const totalHoles = 18 * roundNumbers.length
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
                  <Link href={`/${slug}/teams/${teamId}`} className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    {/* Team color chip */}
                    <span
                      className="inline-block h-3 w-3 rounded-full ring-1 ring-border shrink-0"
                      style={{ backgroundColor: p.teamColor ?? 'var(--color-primary, oklch(0.40 0.11 160))' }}
                      aria-hidden="true"
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm sm:text-base font-medium text-foreground truncate">
                        {p.teamName ?? p.playerName}
                      </span>
                      {/* Stacked member avatars */}
                      <div className="hidden sm:flex -space-x-2 shrink-0">
                        {visibleMembers.map((m) => {
                          const isCaptain = m.tournamentPlayerId === p.captainId
                          return (
                            <div key={m.tournamentPlayerId} className="relative">
                              <Avatar className="h-6 w-6 ring-2 ring-background">
                                <AvatarImage src={m.avatarUrl ?? undefined} />
                                <AvatarFallback className="text-[10px] font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                                  {m.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {isCaptain && (
                                <span
                                  title={`${m.name} (Captain)`}
                                  className="absolute -top-1 -right-1 inline-flex items-center justify-center w-3 h-3 rounded-full bg-yellow-400 text-yellow-900 ring-1 ring-background text-[8px] font-bold"
                                >
                                  C
                                </span>
                              )}
                            </div>
                          )
                        })}
                        {overflow > 0 && (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
                            +{overflow}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </td>

                <td className="text-center"><ScoreCell n={p.netVsPar ?? p.grossVsPar} bold /></td>
                <td className="text-center text-xs sm:text-sm text-muted-foreground">{thru}</td>

                {roundNumbers.map((r) => (
                  <td key={r} className="text-center text-xs sm:text-sm text-muted-foreground hidden lg:table-cell">
                    {p.roundTotals[r] ?? '—'}
                  </td>
                ))}

                {hasNet && (
                  <td className="hidden sm:table-cell text-center text-sm">
                    <ScoreCell n={p.netVsPar} />
                  </td>
                )}
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4 + roundNumbers.length + (hasNet ? 1 : 0)} className="text-center py-12 text-muted-foreground">
                No teams configured yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
