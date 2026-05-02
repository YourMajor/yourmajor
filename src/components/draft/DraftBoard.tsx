'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PowerupCard, type PowerupCardData } from './PowerupCard'
import { DraftPickList } from './DraftPickList'
import { CardHand, CardBack } from './CardHand'
import { FlippableCardOverlay } from './FlippableCardOverlay'
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
  currentPlayerId: string // tournamentPlayerId of the logged-in user
  initialState: DraftState
}

export function DraftBoard({ tournamentId, currentPlayerId, initialState }: DraftBoardProps) {
  const [state, setState] = useState<DraftState>(initialState)
  const [selectedPowerup, setSelectedPowerup] = useState<PowerupCardData | null>(null)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'BOOST' | 'ATTACK'>('ALL')
  const [draftReset, setDraftReset] = useState(false)
  const [falling, setFalling] = useState(false)
  const [highlightCardId, setHighlightCardId] = useState<string | null>(null)

  const isMyTurn = state.currentTurn?.tournamentPlayerId === currentPlayerId
  const myPicks = state.draft.picks.filter((p) => p.tournamentPlayer.id === currentPlayerId)
  const pickedPowerupIds = new Set(state.draft.picks.map((p) => p.powerupId))

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

      // Trigger fall animation
      const pickedId = selectedPowerup.id
      setFalling(true)
      setPicking(false)
      // The fall animation completes via onFallComplete callback
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
    // Clear highlight after a brief glow
    setTimeout(() => setHighlightCardId(null), 1500)
  }, [fetchState])

  const currentPlayerName = state.currentTurn
    ? state.players.find((p) => p.id === state.currentTurn!.tournamentPlayerId)?.user.name ?? 'Player'
    : null

  const filteredPowerups = state.availablePowerups.filter((p) => {
    if (filter === 'ALL') return true
    return p.type === filter
  })

  // Also include picked powerups for the full visual board
  const allPowerups = [
    ...filteredPowerups,
    ...state.draft.picks
      .filter((p) => filter === 'ALL' || p.powerup.type === filter)
      .map((p) => p.powerup),
  ]
  // Deduplicate and sort: available first, then picked
  const uniquePowerups = Array.from(new Map(allPowerups.map((p) => [p.id, p])).values())
  const sortedPowerups = uniquePowerups.sort((a, b) => {
    const aP = pickedPowerupIds.has(a.id) ? 1 : 0
    const bP = pickedPowerupIds.has(b.id) ? 1 : 0
    if (aP !== bP) return aP - bP
    if (a.type !== b.type) return a.type === 'BOOST' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

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

        {/* Playing card hand */}
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
    <div className="space-y-4">
      {/* Turn Banner */}
      <div className={`rounded-lg p-3 text-center ${
        isMyTurn
          ? 'bg-emerald-50 border border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700/50'
          : 'bg-muted/50 border border-border'
      }`}>
        {isMyTurn ? (
          <div>
            <p className="text-lg font-heading font-bold text-emerald-700 dark:text-emerald-300">Your Turn!</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Pick #{state.currentTurn!.pickNumber} &middot; Round {state.currentTurn!.roundNumber}
            </p>
          </div>
        ) : state.currentTurn ? (
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
              Waiting for <span className="text-foreground font-bold">{currentPlayerName}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Pick #{state.currentTurn.pickNumber} &middot; Round {state.currentTurn.roundNumber}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for draft to start...</p>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['ALL', 'BOOST', 'ATTACK'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-foreground/10 text-foreground border border-border'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'BOOST' ? 'Boosts' : 'Attacks'}
          </button>
        ))}
      </div>

      {/* Powerup grid */}
      <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 pt-1">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1 pb-1">
          {sortedPowerups.map((powerup) => {
            const pick = state.draft.picks.find((p) => p.powerupId === powerup.id)
            return (
              <PowerupCard
                key={powerup.id}
                powerup={powerup}
                state={pick ? 'picked' : selectedPowerup?.id === powerup.id ? 'selected' : 'available'}
                pickedBy={pick?.tournamentPlayer.user}
                size="grid"
                onClick={() => {
                  if (!pick && isMyTurn) setSelectedPowerup(powerup)
                }}
                disabled={!isMyTurn || !!pick}
              />
            )
          })}
        </div>
      </div>

      {/* My picks — card hand */}
      {myPicks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-2 text-center">
            Your Hand ({myPicks.length})
          </h3>
          <CardHand cards={myPicks.map((p) => ({ powerupId: p.powerupId, powerup: p.powerup }))} highlightCardId={highlightCardId} />
        </div>
      )}

      {/* Draft board */}
      <div>
        <h3 className="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-2">Draft Board</h3>
        <DraftPickList picks={state.draft.picks} players={state.players} picksPerPlayer={state.powerupsPerPlayer} />
      </div>

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
                    disabled={picking}
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
    </div>
  )
}
