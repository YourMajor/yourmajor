'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { type PowerupCardData } from './PowerupCard'
import { DraftPickList } from './DraftPickList'
import { CardHand, CardBack } from './CardHand'
import { FlippableCardOverlay } from './FlippableCardOverlay'
import { TurnStrip } from './TurnStrip'
import { DraftCountdown } from './DraftCountdown'
import { PowerupFilterBar, type PowerupTypeFilter, type PowerupSortKey } from './PowerupFilterBar'
import { PowerupBrowseGrid } from './PowerupBrowseGrid'
import { PowerupHandSheet } from './PowerupHandSheet'
import { DraftBoardSheet } from './DraftBoardSheet'
import { DraftPeekBar } from './DraftPeekBar'
import { computeCurrentTurn, matchesDurationFilter, type DurationFilter } from '@/lib/draft-utils'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { PowerupEffect } from '@/lib/powerup-engine'
import { togglePowerupFavorite } from '@/app/[slug]/draft/actions'

interface Player {
  id: string
  user: { name: string | null; image: string | null }
}

interface DraftPick {
  id: string
  pickNumber: number
  powerupId: string
  powerup: PowerupCardData
  tournamentPlayer: Player
}

interface DraftState {
  draft: {
    id: string
    format: 'LINEAR' | 'SNAKE'
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED'
    draftOrder: string[]
    currentPick: number
    turnSeconds: number | null
    turnStartedAt: string | null
    picks: DraftPick[]
  }
  currentTurn: {
    tournamentPlayerId: string
    roundNumber: number
    pickNumber: number
  } | null
  availablePowerups: PowerupCardData[]
  players: Player[]
  powerupsPerPlayer: number
  maxAttacksPerPlayer: number
}

interface DraftBoardProps {
  tournamentId: string
  currentPlayerId: string
  isAdmin?: boolean
  initialState: DraftState
  /** User's currently-favourited powerup IDs. Lives outside `initialState`
   *  because the /draft refetch endpoint doesn't return favourites — they're
   *  managed locally with optimistic updates. */
  initialFavoriteIds: string[]
}

function computePicksUntilMine(
  draftOrder: string[],
  format: 'LINEAR' | 'SNAKE',
  totalPicks: number,
  picksPerPlayer: number,
  myId: string,
): number | null {
  const playerCount = draftOrder.length
  if (playerCount === 0) return null
  const totalNeeded = playerCount * picksPerPlayer
  for (let i = totalPicks; i < totalNeeded; i++) {
    const turn = computeCurrentTurn(draftOrder, format, i, picksPerPlayer)
    if (turn?.tournamentPlayerId === myId) return i - totalPicks
  }
  return null
}

export function DraftBoard({
  tournamentId,
  currentPlayerId,
  isAdmin = false,
  initialState,
  initialFavoriteIds,
}: DraftBoardProps) {
  const [state, setState] = useState<DraftState>(initialState)
  const [selectedPowerup, setSelectedPowerup] = useState<PowerupCardData | null>(null)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<PowerupTypeFilter>('ALL')
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('ALL')
  const [sortBy, setSortBy] = useState<PowerupSortKey>('DEFAULT')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(initialFavoriteIds),
  )
  const [draftReset, setDraftReset] = useState(false)
  const [falling, setFalling] = useState(false)
  const [highlightCardId, setHighlightCardId] = useState<string | null>(null)
  const [handSheetOpen, setHandSheetOpen] = useState(false)
  const [boardSheetOpen, setBoardSheetOpen] = useState(false)
  // Guard so we only fire one auto-pick request per turn even though multiple
  // clients may all observe the timer hit zero. The server is the source of
  // truth — the unique (draftId, pickNumber) constraint plus the optimistic
  // currentPick guard make duplicate fires safe; this just avoids needless 409s.
  const autoPickFiredForRef = useRef<number | null>(null)

  const isMyTurn = state.currentTurn?.tournamentPlayerId === currentPlayerId
  const myPicks = state.draft.picks.filter((p) => p.tournamentPlayer.id === currentPlayerId)
  const pickedPowerupIds = useMemo(
    () => new Set(state.draft.picks.map((p) => p.powerupId)),
    [state.draft.picks],
  )

  const currentPlayer = state.currentTurn
    ? state.players.find((p) => p.id === state.currentTurn!.tournamentPlayerId) ?? null
    : null
  const currentPlayerName = currentPlayer?.user.name ?? null
  const currentPlayerImage = currentPlayer?.user.image ?? null

  const picksUntilMine = useMemo(() => {
    if (isMyTurn) return 0
    return computePicksUntilMine(
      state.draft.draftOrder,
      state.draft.format,
      state.draft.currentPick,
      state.powerupsPerPlayer,
      currentPlayerId,
    )
  }, [
    isMyTurn,
    state.draft.draftOrder,
    state.draft.format,
    state.draft.currentPick,
    state.powerupsPerPlayer,
    currentPlayerId,
  ])

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/draft`)
      if (res.ok) {
        const data = await res.json()
        if (data.draft) setState(data as DraftState)
      }
    } catch {
      // Silently fail on refetch
    }
  }, [tournamentId])

  const fireAutoPick = useCallback(async () => {
    try {
      await fetch(`/api/tournaments/${tournamentId}/draft/auto-pick`, {
        method: 'POST',
      })
      // Realtime subscription handles refetch; nothing to do on success
    } catch {
      // Race losers (409) and too-early (425) are expected and harmless
    }
  }, [tournamentId])

  const handleToggleFavorite = useCallback(async (powerupId: string) => {
    // Optimistic flip; revert on error.
    let snapshot: Set<string> | null = null
    setFavoriteIds((prev) => {
      snapshot = prev
      const next = new Set(prev)
      if (next.has(powerupId)) next.delete(powerupId)
      else next.add(powerupId)
      return next
    })
    try {
      await togglePowerupFavorite(powerupId)
    } catch {
      if (snapshot) setFavoriteIds(snapshot)
    }
  }, [])

  // Subscribe to real-time draft pick events and draft status changes.
  //
  // Three independent paths feed scheduleRefetch so a single broken layer
  // (RLS misconfig, dropped websocket, etc.) can't strand a player on a
  // stale "waiting for someone else" view:
  //   1) server-side broadcast on the same channel (RLS-free, primary path)
  //   2) postgres_changes INSERT on DraftPick (legacy, RLS-gated)
  //   3) visibility-aware polling fallback (separate effect below)
  //
  // The subscribe status callback also refetches on (re)connect so any
  // events fired during a brief disconnect are caught up automatically.
  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { fetchState() }, 300)
    }
    const channel = supabase
      .channel(`draft-${state.draft.id}`)
      .on('broadcast', { event: 'pick' }, scheduleRefetch)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'DraftPick',
          filter: `draftId=eq.${state.draft.id}`,
        },
        scheduleRefetch,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Draft',
          filter: `id=eq.${state.draft.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string })?.status
          if (newStatus === 'PENDING') {
            setDraftReset(true)
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void fetchState()
        }
      })

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [state.draft.id, fetchState])

  // Polling fallback while the draft is ACTIVE and the tab is visible.
  // Guarantees turn-flip propagation within ~5s even if both broadcast and
  // postgres_changes are unavailable. Also refetches immediately when the
  // user returns to the tab (covers laptop-sleep / tab-switch).
  useEffect(() => {
    if (state.draft.status !== 'ACTIVE') return

    let interval: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (interval) return
      interval = setInterval(() => { void fetchState() }, 5000)
    }
    const stop = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchState()
        start()
      } else {
        stop()
      }
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [state.draft.status, fetchState])

  const handleConfirmPick = async () => {
    if (!selectedPowerup) return
    setPicking(true)
    setError(null)

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/draft/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ powerupId: selectedPowerup.id }),
      })

      if (!res.ok) {
        let message = 'Failed to make pick. Please try again.'
        try {
          const data = await res.json()
          if (data.error) message = data.error
        } catch {
          // Response wasn't JSON
        }
        throw new Error(message)
      }

      const pickedId = selectedPowerup.id
      setFalling(true)
      setPicking(false)
      setHighlightCardId(pickedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPicking(false)
    }
  }

  const handleFallComplete = useCallback(async () => {
    setFalling(false)
    setSelectedPowerup(null)
    setError(null)
    await fetchState()
    setTimeout(() => setHighlightCardId(null), 1500)
  }, [fetchState])

  // Build the unified powerup list (available + already-picked, with picked metadata)
  const allPowerupsWithStatus = useMemo(() => {
    const available = state.availablePowerups.map((p) => ({ powerup: p, pickedBy: null as Player['user'] | null }))
    const picked = state.draft.picks.map((p) => ({
      powerup: p.powerup,
      pickedBy: p.tournamentPlayer.user,
    }))
    const map = new Map<string, { powerup: PowerupCardData; pickedBy: Player['user'] | null }>()
    for (const a of available) map.set(a.powerup.id, a)
    for (const p of picked) map.set(p.powerup.id, p)
    return Array.from(map.values())
  }, [state.availablePowerups, state.draft.picks])

  // Apply filters + search + sort. Tier 0 (picked sinks) is always applied
  // regardless of sortBy so already-drafted cards stay at the bottom.
  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = allPowerupsWithStatus.filter(({ powerup }) => {
      if (favoritesOnly && !favoriteIds.has(powerup.id)) return false
      if (typeFilter !== 'ALL' && powerup.type !== typeFilter) return false
      if (!matchesDurationFilter(powerup.effect.duration, durationFilter)) return false
      if (q && !(powerup.name.toLowerCase().includes(q) || powerup.description.toLowerCase().includes(q))) return false
      return true
    })
    matches.sort((a, b) => {
      const aP = pickedPowerupIds.has(a.powerup.id) ? 1 : 0
      const bP = pickedPowerupIds.has(b.powerup.id) ? 1 : 0
      if (aP !== bP) return aP - bP

      switch (sortBy) {
        case 'POWER_DESC': {
          // Use absolute value so a -2 boost ranks alongside a +2 attack as
          // "high impact". null modifiers sink within their picked/unpicked tier.
          const aMod = a.powerup.effect.scoring?.modifier
          const bMod = b.powerup.effect.scoring?.modifier
          const aImpact = aMod == null ? -Infinity : Math.abs(aMod)
          const bImpact = bMod == null ? -Infinity : Math.abs(bMod)
          if (aImpact !== bImpact) return bImpact - aImpact
          return a.powerup.name.localeCompare(b.powerup.name)
        }
        case 'DURATION_ASC': {
          const aBucket = a.powerup.effect.duration === 1 ? 0 : 1
          const bBucket = b.powerup.effect.duration === 1 ? 0 : 1
          if (aBucket !== bBucket) return aBucket - bBucket
          return a.powerup.name.localeCompare(b.powerup.name)
        }
        case 'DEFAULT':
        default: {
          if (a.powerup.type !== b.powerup.type) return a.powerup.type === 'BOOST' ? -1 : 1
          return a.powerup.name.localeCompare(b.powerup.name)
        }
      }
    })
    return matches
  }, [allPowerupsWithStatus, typeFilter, durationFilter, search, sortBy, pickedPowerupIds, favoritesOnly, favoriteIds])

  // Counts for the segmented control (across all available + picked)
  const counts = useMemo(() => {
    let boost = 0
    let attack = 0
    for (const { powerup } of allPowerupsWithStatus) {
      if (powerup.type === 'BOOST') boost++
      else if (powerup.type === 'ATTACK') attack++
    }
    return { ALL: boost + attack, BOOST: boost, ATTACK: attack }
  }, [allPowerupsWithStatus])

  const durationCounts = useMemo(() => {
    let single = 0
    let multi = 0
    for (const { powerup } of allPowerupsWithStatus) {
      if (powerup.effect.duration === 1) single++
      else multi++
    }
    return { ALL: single + multi, SINGLE: single, MULTI: multi }
  }, [allPowerupsWithStatus])

  const hasFilters = search.trim().length > 0 || typeFilter !== 'ALL' || durationFilter !== 'ALL' || favoritesOnly

  const favoriteCount = useMemo(
    () => allPowerupsWithStatus.reduce((n, x) => n + (favoriteIds.has(x.powerup.id) ? 1 : 0), 0),
    [allPowerupsWithStatus, favoriteIds],
  )

  if (draftReset) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-lg font-heading font-bold text-foreground">Draft Has Been Reset</p>
        <p className="text-sm text-muted-foreground">The admin has reset the draft. The page will refresh momentarily.</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Refresh Now
        </Button>
      </div>
    )
  }

  if (state.draft.status === 'COMPLETED') {
    return (
      <div className="space-y-8">
        <div className="text-center py-2">
          <h2 className="text-xl font-heading font-bold text-foreground">Draft Complete!</h2>
          <p className="text-sm text-muted-foreground mt-1">Your hand is ready to play.</p>
        </div>

        {/* Playing card hand (desktop fan + mobile horizontal scroll fallback) */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">Your Hand</h3>
          <CardHand cards={myPicks.map((p) => ({ powerupId: p.powerupId, powerup: p.powerup }))} />
        </div>

        {/* Draft board inline */}
        <div className="border-t border-border pt-6">
          <h3 className="text-lg font-heading font-bold text-foreground mb-3">Draft Board</h3>
          <DraftPickList
            picks={state.draft.picks}
            players={state.players}
            picksPerPlayer={state.powerupsPerPlayer}
            isAdmin={isAdmin}
            tournamentId={tournamentId}
            availablePowerups={state.availablePowerups}
            onPickEdited={fetchState}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Reserve space at the bottom so last cards aren't hidden behind the
          mobile peek bar (~56px) + the global BottomTabBar (~64px) + safe-area */}
      <div className="space-y-3 pb-[140px] lg:pb-0">
        <TurnStrip
          isMyTurn={isMyTurn}
          currentPlayerName={currentPlayerName}
          pickNumber={state.currentTurn?.pickNumber ?? null}
          roundNumber={state.currentTurn?.roundNumber ?? null}
          picksUntilMine={picksUntilMine}
        />

        {state.draft.status === 'ACTIVE' && state.draft.turnSeconds && state.draft.turnStartedAt && (
          <DraftCountdown
            turnSeconds={state.draft.turnSeconds}
            turnStartedAt={state.draft.turnStartedAt}
            currentPick={state.draft.currentPick}
            onExpire={() => {
              if (autoPickFiredForRef.current === state.draft.currentPick) return
              autoPickFiredForRef.current = state.draft.currentPick
              void fireAutoPick()
            }}
          />
        )}

        <PowerupFilterBar
          search={search}
          onSearchChange={setSearch}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          durationFilter={durationFilter}
          onDurationFilterChange={setDurationFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          counts={counts}
          durationCounts={durationCounts}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          favoriteCount={favoriteCount}
        />

        <PowerupBrowseGrid
          powerups={filteredAndSorted.map((x) => x.powerup)}
          picks={filteredAndSorted
            .filter((x) => x.pickedBy !== null)
            .map((x) => ({ powerupId: x.powerup.id, pickedBy: x.pickedBy! }))}
          selectedId={selectedPowerup?.id ?? null}
          isMyTurn={isMyTurn}
          hasFilters={hasFilters}
          onSelect={(p) => setSelectedPowerup(p)}
          onClearFilters={() => {
            setSearch('')
            setTypeFilter('ALL')
            setDurationFilter('ALL')
            setFavoritesOnly(false)
          }}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
        />

        {/* Desktop-only: inline hand + draft board (mobile uses sheets via peek bar) */}
        <div className="hidden lg:block space-y-6 pt-6">
          {myPicks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-2 text-center">
                Your Hand ({myPicks.length})
              </h3>
              <CardHand
                cards={myPicks.map((p) => ({ powerupId: p.powerupId, powerup: p.powerup }))}
                highlightCardId={highlightCardId}
              />
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-2">Draft Board</h3>
            <DraftPickList
              picks={state.draft.picks}
              players={state.players}
              picksPerPlayer={state.powerupsPerPlayer}
              isAdmin={isAdmin}
              tournamentId={tournamentId}
              availablePowerups={state.availablePowerups}
              onPickEdited={fetchState}
            />
          </div>
        </div>
      </div>

      {/* Mobile peek bar */}
      <DraftPeekBar
        isMyTurn={isMyTurn}
        currentPlayerName={currentPlayerName}
        currentPlayerImage={currentPlayerImage}
        picksUntilMine={picksUntilMine}
        handCount={myPicks.length}
        onOpenHand={() => setHandSheetOpen(true)}
        onOpenBoard={() => setBoardSheetOpen(true)}
      />

      {/* Mobile sheets */}
      <PowerupHandSheet
        open={handSheetOpen}
        onClose={() => setHandSheetOpen(false)}
        cards={myPicks.map((p) => ({ powerupId: p.powerupId, powerup: p.powerup }))}
      />
      <DraftBoardSheet
        open={boardSheetOpen}
        onClose={() => setBoardSheetOpen(false)}
        picks={state.draft.picks}
        players={state.players}
        draftOrder={state.draft.draftOrder}
        format={state.draft.format}
        picksPerPlayer={state.powerupsPerPlayer}
        currentRound={state.currentTurn?.roundNumber ?? null}
        currentPlayerId={state.currentTurn?.tournamentPlayerId ?? null}
      />

      {/* Confirm pick flip overlay */}
      <FlippableCardOverlay
        powerup={selectedPowerup}
        onClose={() => { setSelectedPowerup(null); setError(null) }}
        fallAnimation={falling}
        onFallComplete={handleFallComplete}
        backContent={(animatedClose) =>
          selectedPowerup ? (
            <CardBack
              slug={selectedPowerup.slug}
              name={selectedPowerup.name}
              type={selectedPowerup.type}
              description={selectedPowerup.description}
              effect={selectedPowerup.effect as PowerupEffect}
              isAttack={selectedPowerup.type === 'ATTACK'}
              onClose={animatedClose}
              customFooter={
                <>
                  {error && (
                    <p className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mb-2 w-full">
                      {error}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={animatedClose}
                    disabled={picking}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-200 transition-colors"
                  >
                    Put Down
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPick}
                    disabled={picking || !isMyTurn}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors disabled:opacity-50"
                  >
                    {picking ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Picking...
                      </span>
                    ) : (
                      'Confirm Pick'
                    )}
                  </button>
                </>
              }
            />
          ) : null
        }
      />
    </>
  )
}
