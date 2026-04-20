'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ChevronDown, Crown, Search } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { type PlayerStanding } from '@/lib/scoring-utils'
import { ComparativeScoreChart } from './ComparativeScoreChart'

function vsParLabel(n: number): string {
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : `${n}`
}

function getShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return parts[0]
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`
}

function ScoreCell({ n, stableford = false, bold = false }: { n: number | null; stableford?: boolean; bold?: boolean }) {
  if (n === null) return <span className="text-muted-foreground">—</span>
  if (stableford) return <span className={bold ? 'font-bold' : 'font-semibold'}>{n}</span>
  const label = vsParLabel(n)
  const color = n < 0 ? 'text-red-600' : n === 0 ? 'text-foreground' : 'text-foreground'
  const weight = bold ? 'font-extrabold' : 'font-semibold'
  return <span className={`${color} ${weight}`}>{label}</span>
}

function FilterPill({ value, options, onChange }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none cursor-pointer rounded-lg border border-border bg-background px-2.5 sm:px-4 py-1.5 sm:py-2 pr-7 sm:pr-8 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 min-h-[40px] sm:min-h-[44px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-muted-foreground" />
    </div>
  )
}

interface ScoringCta {
  label: string
  href: string
  holesPlayed: number
  totalHoles: number
}

interface Props {
  initialData: PlayerStanding[]
  tournamentId: string
  roundNumbers: number[]
  slug: string
  status: string
  scoringCta?: ScoringCta
  defendingChampionPlayerId?: string | null
  startDate?: string | null
  isRegistered?: boolean
  handicapSystem?: string
}

export function LiveLeaderboard({ initialData, tournamentId, roundNumbers, slug, status, scoringCta, defendingChampionPlayerId, startDate, isRegistered, handicapSystem }: Props) {
  const [standings, setStandings] = useState<PlayerStanding[]>(initialData)
  const [loading, setLoading] = useState(false)
  const [scoreType, setScoreType] = useState<'gross' | 'net'>('gross')
  const [roundFilter, setRoundFilter] = useState<string>('all')
  const [playerSearch, setPlayerSearch] = useState('')

  const isStableford = standings.some((s) => s.points !== null)
  const hasNet = standings.some((s) => s.netVsPar !== null)
  const totalHoles = 18 * roundNumbers.length

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/leaderboard`)
      if (res.ok) setStandings(await res.json())
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`leaderboard-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Score' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId, refresh])

  useEffect(() => {
    if (status !== 'ACTIVE') return
    const id = setInterval(refresh, 15000)
    return () => clearInterval(id)
  }, [status, refresh])

  const sorted = useMemo(() => [...standings].sort((a, b) => {
    if (isStableford) {
      if (a.points === null && b.points === null) return 0
      if (a.points === null) return 1
      if (b.points === null) return -1
      return b.points - a.points
    }
    const av = scoreType === 'net' ? a.netVsPar : a.grossVsPar
    const bv = scoreType === 'net' ? b.netVsPar : b.grossVsPar
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return av - bv
  }), [standings, isStableford, scoreType])

  type Ranked = PlayerStanding & { displayRank: string }
  const withRanks: Ranked[] = useMemo(() => {
    const result: Ranked[] = []
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i]
      const val = isStableford ? p.points : scoreType === 'net' ? p.netVsPar : p.grossVsPar
      const prev = i > 0 ? result[i - 1] : null
      const prevVal = prev
        ? (isStableford ? prev.points : scoreType === 'net' ? prev.netVsPar : prev.grossVsPar)
        : null
      const nextVal = i < sorted.length - 1
        ? (isStableford ? sorted[i + 1].points : scoreType === 'net' ? sorted[i + 1].netVsPar : sorted[i + 1].grossVsPar)
        : null
      const rank = i === 0 ? 1 : prevVal === val ? parseInt(prev!.displayRank.replace('T', '')) : i + 1
      const isTied = val !== null && (prevVal === val || nextVal === val)
      result.push({ ...p, displayRank: isTied ? `T${rank}` : `${rank}` })
    }
    return result
  }, [sorted, isStableford, scoreType])

  const hasScores = standings.some((s) => s.holesPlayed > 0)
  const showingRound = roundFilter !== 'all' ? Number(roundFilter) : null

  const scoreTypeOptions = [
    { value: 'gross', label: 'Traditional' },
    ...(hasNet ? [{ value: 'net', label: 'Net' }] : []),
  ]
  const roundOptions = [
    { value: 'all', label: 'All Rounds' },
    ...roundNumbers.map((r) => ({ value: `${r}`, label: `Round ${r}` })),
  ]

  const showFullTable = hasScores || status === 'ACTIVE' || status === 'COMPLETED'

  const searchTerm = playerSearch.trim().toLowerCase()
  const filteredRanks = useMemo(
    () => searchTerm
      ? withRanks.filter((p) => p.playerName.toLowerCase().includes(searchTerm))
      : withRanks,
    [withRanks, searchTerm]
  )

  // Pre-tournament: simple registered players table
  if (!showFullTable) {
    const startDateObj = startDate ? new Date(startDate) : null
    const formattedStart = startDateObj
      ? startDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null

    return (
      <div>
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-semibold">
          {standings.length} Player{standings.length !== 1 ? 's' : ''} Registered
        </p>
        {isRegistered && formattedStart && (
          <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30 flex items-center gap-2">
            <span className="text-sm">&#9203;</span>
            <p className="text-sm text-muted-foreground">
              Live scoring will be available when the tournament begins on <span className="font-semibold text-foreground">{formattedStart}</span>
            </p>
          </div>
        )}
        {standings.length > 0 && (
          <div className="rounded-lg overflow-hidden">
            <table className="masters-table">
              <thead>
                <tr>
                  <th className="text-left w-8">POS</th>
                  <th className="text-left">PLAYER</th>
                  <th className="text-right">HCP</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.tournamentPlayerId}>
                    <td className="text-center text-sm text-muted-foreground">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="relative shrink-0">
                          {defendingChampionPlayerId === p.tournamentPlayerId ? (
                            <div className="rounded-full p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600">
                              <Avatar className="h-7 w-7 ring-1 ring-background">
                                <AvatarImage src={p.avatarUrl ?? undefined} />
                                <AvatarFallback className="text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                                  {p.playerName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          ) : (
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={p.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                                {p.playerName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {defendingChampionPlayerId === p.tournamentPlayerId && (
                            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-yellow-400 text-yellow-900 ring-1 ring-background">
                              <Crown className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium">{getShortName(p.playerName)}</span>
                      </div>
                    </td>
                    <td className="text-right text-sm text-muted-foreground">{p.handicap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Filters + Search + Scoring CTA */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-4 lg:mb-6 flex-wrap">
        {!isStableford && (
          <FilterPill value={scoreType} options={scoreTypeOptions} onChange={(v) => setScoreType(v as 'gross' | 'net')} />
        )}
        {roundNumbers.length > 1 && (
          <FilterPill value={roundFilter} options={roundOptions} onChange={setRoundFilter} />
        )}

        {/* Player search — inline with filters */}
        <div className="relative flex items-center flex-1 min-w-0 sm:flex-none">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search"
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            className="rounded-lg border border-border bg-background pl-7 pr-2 py-1.5 sm:py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 w-full sm:w-48 min-h-[40px] sm:min-h-[44px]"
          />
        </div>

        {loading && <span className="text-xs text-muted-foreground animate-pulse shrink-0">Updating\u2026</span>}

        {/* Scoring CTA */}
        {scoringCta && (
          <Link
            href={scoringCta.href}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap min-h-[40px] sm:min-h-[44px]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {scoringCta.label}
            <span className="text-white/70 text-[11px] sm:text-xs font-normal hidden sm:inline">
              {scoringCta.holesPlayed}/{scoringCta.totalHoles}
            </span>
          </Link>
        )}
      </div>

      {/* Masters-style leaderboard table */}
      <div className="rounded-lg overflow-hidden">
        <table className="masters-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }} className="px-0">POS</th>
              <th className="text-left pl-3 sm:pl-4">PLAYER</th>
              <th style={{ width: '10%' }}>TOTAL</th>
              <th className="hidden sm:table-cell" style={{ width: '8%' }}>THRU</th>
              <th className="hidden sm:table-cell" style={{ width: '8%' }}>TODAY</th>
              {roundNumbers.map((r) => (
                <th key={r} className="hidden lg:table-cell" style={{ width: '7%' }}>R{r}</th>
              ))}
              {!isStableford && scoreType === 'gross' && hasNet && (
                <th style={{ width: '10%' }}>NET</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRanks.map((p) => {
              const totalVal = isStableford ? p.points
                : scoreType === 'net' ? p.netVsPar
                : showingRound !== null ? null
                : p.grossVsPar

              const thru = p.holesPlayed === 0 ? null
                : p.holesPlayed >= totalHoles ? 'F'
                : p.holesPlayed

              return (
                <tr key={p.tournamentPlayerId} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  {/* Position */}
                  <td className="text-center px-0" style={{ width: '36px' }}>
                    {p.holesPlayed === 0 ? (
                      <span className="text-muted-foreground/50 text-sm">—</span>
                    ) : (
                      <span className="text-sm font-bold">
                        {p.displayRank.startsWith('T') ? (
                          <><span className="text-muted-foreground text-xs">T</span>{p.displayRank.slice(1)}</>
                        ) : (
                          p.displayRank
                        )}
                      </span>
                    )}
                  </td>

                  {/* Player */}
                  <td className="pl-3 sm:pl-4">
                    <div className="relative group/player">
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
                      {/* Masters-style hover tooltip — positioned in dead space to the right */}
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover/player:flex items-center z-10">
                        <Link
                          href={`/${slug}/players/${p.tournamentPlayerId}`}
                          className="whitespace-nowrap rounded-md bg-white border border-border shadow-lg px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          Click to View Player Profile
                        </Link>
                      </div>
                    </div>
                  </td>

                  {/* Total */}
                  <td className="text-center">
                    <span className="text-sm">
                      {showingRound !== null
                        ? <span className="font-bold">{p.roundTotals[showingRound] ?? '—'}</span>
                        : <ScoreCell n={totalVal} stableford={isStableford} bold />
                      }
                    </span>
                  </td>

                  {/* Thru */}
                  <td className="text-center text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                    {thru ?? '—'}
                  </td>

                  {/* Today */}
                  <td className="text-center text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                    {p.todayTotal ?? '—'}
                  </td>

                  {/* Round totals */}
                  {roundNumbers.map((r) => (
                    <td key={r} className="text-center text-xs sm:text-sm text-muted-foreground hidden lg:table-cell">
                      {p.roundTotals[r] ?? '—'}
                    </td>
                  ))}

                  {/* Net */}
                  {!isStableford && scoreType === 'gross' && hasNet && (
                    <td className="text-center text-sm">
                      <ScoreCell n={p.netVsPar} />
                    </td>
                  )}
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5 + roundNumbers.length} className="text-center py-12 text-muted-foreground">
                  No players registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Comparative score progression chart for completed non-handicap tournaments */}
      {status === 'COMPLETED' && handicapSystem === 'NONE' && (
        <ComparativeScoreChart standings={standings} />
      )}
    </div>
  )
}
