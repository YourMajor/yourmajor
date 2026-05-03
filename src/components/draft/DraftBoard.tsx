'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { type PowerupCardData } from './PowerupCard'
import { DraftPickList } from './DraftPickList'
import { CardHand, CardBack } from './CardHand'
import { FlippableCardOverlay } from './FlippableCardOverlay'
import { TurnStrip } from './TurnStrip'
import { PowerupFilterBar, type PowerupTypeFilter } from './PowerupFilterBar'
import { PowerupBrowseGrid } from './PowerupBrowseGrid'
import { PowerupHandSheet } from './PowerupHandSheet'
import { DraftBoardSheet } from './DraftBoardSheet'
import { DraftPeekBar } from './DraftPeekBar'
import { computeCurrentTurn, matchesDurationFilter, type DurationFilter } from '@/lib/draft-utils'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { PowerupEffect } from '@/lib/powerup-engine'

interface Player {
  id: string
  user: { name: string | null; image: string | null }
}

interface DraftPick {
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
  initialState: DraftState
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

export function DraftBoard({ tournamentId, currentPlayerId, initialState }: DraftBoardProps) {
  const [state, setState] = useState<DraftState>(initialState)
  const [selectedPowerup, setSelectedPowerup] = useState<PowerupCardData | null>(null)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<PowerupTypeFilter>('ALL')
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('ALL')
  const [draftReset, setDraftReset] = useState(false)
  const [falling, setFalling] = useState(false)
  const [highlightCardId, setHighlightCardId] = useState<string | null>(null)
  const [handSheetOpen, setHandSheetOpen] = useState(false)
  const [boardSheetOpen, setBoardSheetOpen] = useState(false)

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

  // Subscribe to real-time draft pick events and draft status changes.
  // DraftPick INSERTs can arrive in quick succession during a snake draft;
  // we coalesce them into a single state refetch so a 6-pick burst doesn't
  // trigger 6 round-trips.
  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { fetchState() }, 300)
    }
    const channel = supabase
      .channel(`draft-${state.draft.id}`)
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
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [state.draft.id, fetchState])

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

  // Apply filters + search + sort
  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = allPowerupsWithStatus.filter(({ powerup }) => {
      if (typeFilter !== 'ALL' && powerup.type !== typeFilter) return false
      if (!matchesDurationFilter(powerup.effect.duration, durationFilter)) return false
      if (q && !(powerup.name.toLowerCase().includes(q) || powerup.description.toLowerCase().includes(q))) return false
      return true
    })
    matches.sort((a, b) => {
      const aP = pickedPowerupIds.has(a.powerup.id) ? 1 : 0
      const bP = pickedPowerupIds.has(b.powerup.id) ? 1 : 0
      if (aP !== bP) return aP - bP
      if (a.powerup.type !== b.powerup.type) return a.powerup.type === 'BOOST' ? -1 : 1
      return a.powerup.name.localeCompare(b.powerup.name)
    })
    return matches
  }, [allPowerupsWithStatus, typeFilter, durationFilter, search, pickedPowerupIds])

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

  const hasFilters = search.trim().length > 0 || typeFilter !== 'ALL' || durationFilter !== 'ALL'

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
          <DraftPickList picks={state.draft.picks} players={state.players} picksPerPlayer={state.powerupsPerPlayer} />
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

        <PowerupFilterBar
          search={search}
          onSearchChange={setSearch}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          durationFilter={durationFilter}
          onDurationFilterChange={setDurationFilter}
          counts={counts}
          durationCounts={durationCounts}
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
          onClearFilters={() => { setSearch(''); setTypeFilter('ALL') }}
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
            <DraftPickList picks={state.draft.picks} players={state.players} picksPerPlayer={state.powerupsPerPlayer} />
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
