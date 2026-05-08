'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ChevronDown, Crown, Lock, Search } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { type PlayerStanding, type StandingKind } from '@/lib/scoring-utils'
import { ComparativeScoreChart } from './ComparativeScoreChart'
import { MatchPlayLeaderboardTable } from './MatchPlayLeaderboardTable'
import { SkinsLeaderboardTable } from './SkinsLeaderboardTable'
import { TeamLeaderboardTable } from './TeamLeaderboardTable'
import { NassauLeaderboardTable } from './NassauLeaderboardTable'
import { LowGrossNetLeaderboardTable } from './LowGrossNetLeaderboardTable'
import { FormatInfoButton } from './FormatInfoButton'

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
  const color = n < 0 ? 'text-score-birdie' : n === 0 ? 'text-score-par' : 'text-score-bogey'
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
  roundIds: string[]
  slug: string
  status: string
  scoringCta?: ScoringCta
  defendingChampionPlayerId?: string | null
  isRegistered?: boolean
  handicapSystem?: string
  tournamentFormat?: string
}

export function LiveLeaderboard({ initialData, tournamentId, roundNumbers, roundIds, slug, status, scoringCta, defendingChampionPlayerId, isRegistered, handicapSystem, tournamentFormat }: Props) {
  const [standings, setStandings] = useState<PlayerStanding[]>(initialData)
  const [loading, setLoading] = useState(false)
  const [scoreType, setScoreType] = useState<'gross' | 'net'>('gross')
  const [roundFilter, setRoundFilter] = useState<string>('all')
  const [playerSearch, setPlayerSearch] = useState('')

  // Format detection prefers the per-row `kind` discriminator. Old cached blobs
  // and stableford-via-handicap-system paths still set `points`, so we fall
  // back to that heuristic if no row carries `kind` yet.
  const standingKind: StandingKind | undefined = standings[0]?.kind
  const isStableford = standingKind === 'stableford'
    || (standingKind === undefined && standings.some((s) => s.points !== null))
  const isMatchPlay = standingKind === 'match'
  const isSkins = standingKind === 'skins'
  const isTeamFormat = standingKind === 'team-stroke' || standingKind === 'team-best-ball'
  const isNassau = standingKind === 'nassau'
  const isLowGrossNet = standingKind === 'low-gross-net'
  const isPointsSort = isStableford || isMatchPlay || isSkins || isNassau
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundIdSet = useMemo(() => new Set(roundIds), [roundIds])

  useEffect(() => {
    const supabase = createClient()
    const scheduleRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      // 150ms coalesces a burst of writes (e.g., a player saving multiple
      // holes in a row) into one refetch while keeping the spectator's
      // perceived lag well under "feels slow" territory (~1s).
      debounceRef.current = setTimeout(() => { refresh() }, 150)
    }
    const channel = supabase
      .channel(`leaderboard-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Score' },
        (payload) => {
          const row = (payload.new ?? payload.old) as { roundId?: string } | null
          if (row?.roundId && !roundIdSet.has(row.roundId)) return
          scheduleRefresh()
        },
      )
      .subscribe()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [tournamentId, refresh, roundIdSet])

  // Sort + tied-rank computation depends only on the full standings + score
  // mode. Keeping it in its own memo means typing in the search box doesn't
  // re-run a full O(N) sort over every player on each keystroke.
  const sorted = useMemo(() => [...standings].sort((a, b) => {
    if (isPointsSort) {
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
  }), [standings, isPointsSort, scoreType])

  type Ranked = PlayerStanding & { displayRank: string }
  const withRanks: Ranked[] = useMemo(() => {
    const result: Ranked[] = []
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i]
      const val = isPointsSort ? p.points : scoreType === 'net' ? p.netVsPar : p.grossVsPar
      const prev = i > 0 ? result[i - 1] : null
      const prevVal = prev
        ? (isPointsSort ? prev.points : scoreType === 'net' ? prev.netVsPar : prev.grossVsPar)
        : null
      const nextVal = i < sorted.length - 1
        ? (isPointsSort ? sorted[i + 1].points : scoreType === 'net' ? sorted[i + 1].netVsPar : sorted[i + 1].grossVsPar)
        : null
      const rank = i === 0 ? 1 : prevVal === val ? parseInt(prev!.displayRank.replace('T', '')) : i + 1
      const isTied = val !== null && (prevVal === val || nextVal === val)
      result.push({ ...p, displayRank: isTied ? `T${rank}` : `${rank}` })
    }
    return result
  }, [sorted, isPointsSort, scoreType])

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

  // Peoria: collect the per-round reveal info. The 6 secret holes are the same
  // for every player in the field, so we read them off any standing that has
  // them. For rounds where no standing carries an entry, the round is still in
  // progress and the holes stay hidden.
  const isPeoria = handicapSystem === 'PEORIA'
  const peoriaReveal = useMemo(() => {
    if (!isPeoria) return null
    const detailsByRound = new Map<number, { secretHoles: number[]; peoriaHandicap: number }>()
    for (const s of standings) {
      if (!s.peoriaRoundDetails) continue
      for (const [roundStr, info] of Object.entries(s.peoriaRoundDetails)) {
        const r = Number(roundStr)
        if (!detailsByRound.has(r)) detailsByRound.set(r, info)
      }
    }
    return roundNumbers.map((r) => ({ roundNumber: r, revealed: detailsByRound.get(r) ?? null }))
  }, [isPeoria, standings, roundNumbers])

  const searchTerm = playerSearch.trim().toLowerCase()
  const filteredRanks = useMemo(
    () => searchTerm
      ? withRanks.filter((p) => p.playerName.toLowerCase().includes(searchTerm))
      : withRanks,
    [withRanks, searchTerm]
  )

  // Pre-tournament: simple registered players table
  if (!showFullTable) {
    return (
      <div>
        {tournamentFormat && (
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <FormatInfoButton formatId={tournamentFormat} />
          </div>
        )}
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-semibold">
          {standings.length} Player{standings.length !== 1 ? 's' : ''} Registered
        </p>
        {isRegistered && (
          <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30 flex items-center gap-2">
            <span className="text-sm">&#9203;</span>
            <p className="text-sm text-muted-foreground">
              Live scoring will be available once the tournament is started.
            </p>
          </div>
        )}
        {standings.length > 0 && (
          <div className="rounded-lg overflow-hidden overflow-x-auto" role="region" aria-label="Registered players">
            <table className="masters-table">
              <caption className="sr-only">Registered players — {standings.length} total</caption>
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
      {tournamentFormat && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <FormatInfoButton formatId={tournamentFormat} />
        </div>
      )}

      {/* Filters + Search + Scoring CTA */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-4 lg:mb-6 flex-wrap">
        {!isPointsSort && (
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

        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground animate-spin" />
            Updating
          </span>
        )}

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

      {/* Peoria: secret-hole reveal panel. Each round shows either its 6 secret
          hole numbers (after every player has finished) or a "hidden" lock —
          revealing live would give away which holes the handicap depends on. */}
      {peoriaReveal && peoriaReveal.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs sm:text-sm">
          <div className="font-semibold text-foreground mb-1.5 uppercase tracking-wide text-[10px] sm:text-xs">
            Peoria secret holes
          </div>
          <ul className="space-y-1">
            {peoriaReveal.map(({ roundNumber, revealed }) => (
              <li key={roundNumber} className="flex items-center gap-2">
                {peoriaReveal.length > 1 && (
                  <span className="font-medium text-muted-foreground shrink-0">R{roundNumber}:</span>
                )}
                {revealed ? (
                  <span className="font-mono tabular-nums text-foreground">
                    {revealed.secretHoles.join(', ')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Lock className="w-3 h-3" />
                    Hidden until round complete
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Match play renders its own table (W-L-H + status). */}
      {isMatchPlay ? (
        <MatchPlayLeaderboardTable
          rows={filteredRanks}
          slug={slug}
          loading={loading}
          defendingChampionPlayerId={defendingChampionPlayerId}
          playerNames={Object.fromEntries(standings.map((s) => [s.tournamentPlayerId, s.playerName]))}
        />
      ) : isSkins ? (
        <SkinsLeaderboardTable
          rows={filteredRanks}
          slug={slug}
          loading={loading}
          defendingChampionPlayerId={defendingChampionPlayerId}
          trailingCarryover={standings[0]?.skinsTrailingCarryover ?? 0}
          showValueColumn={(standings[0]?.skinsValue ?? 1) > 1}
        />
      ) : isTeamFormat ? (
        <TeamLeaderboardTable
          rows={filteredRanks}
          slug={slug}
          loading={loading}
          roundNumbers={roundNumbers}
          hasNet={hasNet}
        />
      ) : isNassau ? (
        <NassauLeaderboardTable
          rows={filteredRanks}
          slug={slug}
          loading={loading}
          defendingChampionPlayerId={defendingChampionPlayerId}
        />
      ) : isLowGrossNet ? (
        <LowGrossNetLeaderboardTable
          rows={filteredRanks}
          slug={slug}
          loading={loading}
          defendingChampionPlayerId={defendingChampionPlayerId}
        />
      ) : (
      <div className="rounded-lg overflow-hidden overflow-x-auto" role="region" aria-label="Leaderboard">
        <table className="masters-table">
          <caption className="sr-only">Tournament leaderboard — {filteredRanks.length} players</caption>
          <thead>
            <tr>
              <th style={{ width: '36px' }} className="px-0">POS</th>
              <th className="text-left pl-3 sm:pl-4">PLAYER</th>
              <th style={{ width: '10%' }}>TOTAL</th>
              <th style={{ width: '8%' }}>THRU</th>
              <th className="hidden sm:table-cell" style={{ width: '8%' }}>TODAY</th>
              {roundNumbers.map((r) => (
                <th key={r} className="hidden lg:table-cell" style={{ width: '7%' }}>R{r}</th>
              ))}
              {!isStableford && scoreType === 'gross' && hasNet && (
                <th style={{ width: '10%' }}>NET</th>
              )}
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {filteredRanks.map((p) => {
              const totalVal = isStableford ? p.points
                : scoreType === 'net' ? p.netVsPar
                : showingRound !== null ? null
                : p.grossVsPar

              const thru = p.holesPlayed === 0 ? null
                : p.holesPlayed >= totalHoles ? 'F'
                : p.holesPlayed

              return (
                <tr key={p.tournamentPlayerId} className="cursor-pointer hover:bg-muted/50 active:bg-muted/70 transition-colors">
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
                      {(() => {
                        // Team rows store team.id in tournamentPlayerId, so the
                        // per-player link 404s. Phase 4 will wire /teams/{id};
                        // for now team rows render without a link.
                        const isTeamRow = p.kind === 'team-stroke' || p.kind === 'team-best-ball'
                        const inner = (
                          <>
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
                              {isTeamRow ? p.playerName : getShortName(p.playerName)}
                            </span>
                          </>
                        )
                        return isTeamRow ? (
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">{inner}</div>
                        ) : (
                          <>
                            <Link href={`/${slug}/players/${p.tournamentPlayerId}`} className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                              {inner}
                            </Link>
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover/player:flex items-center z-10">
                              <Link
                                href={`/${slug}/players/${p.tournamentPlayerId}`}
                                className="whitespace-nowrap rounded-md bg-white border border-border shadow-lg px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                              >
                                Click to View Player Profile
                              </Link>
                            </div>
                          </>
                        )
                      })()}
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
                  <td className="text-center text-xs sm:text-sm text-muted-foreground">
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
      )}

      {/* Comparative score progression chart for completed non-handicap tournaments */}
      {status === 'COMPLETED' && handicapSystem === 'NONE' && (
        <ComparativeScoreChart standings={standings} />
      )}
    </div>
  )
}
