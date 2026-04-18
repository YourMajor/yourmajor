'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DraftBoard } from './DraftBoard'
import { DealAnimation } from './DealAnimation'
import { GripVertical, ArrowUp, ArrowDown, Loader2, Shuffle, Play } from 'lucide-react'
import type { PowerupCardData } from './PowerupCard'

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

interface DraftData {
  id: string
  format: 'LINEAR' | 'SNAKE'
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED'
  draftOrder: string[]
  currentPick: number
  picks: DraftPick[]
}

interface DraftAdminProps {
  tournamentId: string
  currentPlayerId: string
  draft: DraftData | null
  distributionMode: 'DRAFT' | 'RANDOM'
  players: Player[]
  availablePowerups: PowerupCardData[]
  powerupsPerPlayer: number
  maxAttacksPerPlayer: number
  currentTurn: { tournamentPlayerId: string; roundNumber: number; pickNumber: number } | null
}

export function DraftAdmin({
  tournamentId,
  currentPlayerId,
  draft,
  distributionMode,
  players,
  availablePowerups,
  powerupsPerPlayer,
  maxAttacksPerPlayer,
  currentTurn,
}: DraftAdminProps) {
  const [order, setOrder] = useState<string[]>(
    draft?.draftOrder?.length ? draft.draftOrder : players.map((p) => p.id),
  )
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDealAnimation, setShowDealAnimation] = useState(false)

  const movePlayer = useCallback((index: number, direction: -1 | 1) => {
    const newOrder = [...order]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= newOrder.length) return
    ;[newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]]
    setOrder(newOrder)
  }, [order])

  const handleSetOrder = async () => {
    setLoading('order')
    setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/draft/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      })
      if (!res.ok) {
        let message = 'Failed to set draft order.'
        try { const data = await res.json(); if (data.error) message = data.error } catch {}
        throw new Error(message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set draft order')
    } finally {
      setLoading(null)
    }
  }

  const handleStartDraft = async () => {
    setLoading('start')
    setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/draft/start`, {
        method: 'POST',
      })
      if (!res.ok) {
        let message = 'Failed to start draft.'
        try { const data = await res.json(); if (data.error) message = data.error } catch {}
        throw new Error(message)
      }
      // Reload to get active state
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start draft')
    } finally {
      setLoading(null)
    }
  }

  const handleRandomDeal = async () => {
    setLoading('random')
    setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/draft/random`, {
        method: 'POST',
      })
      if (!res.ok) {
        let message = 'Failed to deal powerups.'
        try { const data = await res.json(); if (data.error) message = data.error } catch {}
        throw new Error(message)
      }
      // Show the deal animation
      setLoading(null)
      setShowDealAnimation(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deal powerups')
      setLoading(null)
    }
  }

  // RANDOM mode — show the deal button + animation
  if (distributionMode === 'RANDOM') {
    return (
      <div className="space-y-6">
        {showDealAnimation && (
          <DealAnimation
            players={players}
            totalCards={players.length * powerupsPerPlayer}
            onComplete={() => window.location.reload()}
          />
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Random Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Shuffle and deal {powerupsPerPlayer} powerup{powerupsPerPlayer !== 1 ? 's' : ''} to each
              of the {players.length} registered player{players.length !== 1 ? 's' : ''}.
              Each player will receive up to {maxAttacksPerPlayer} attack card{maxAttacksPerPlayer !== 1 ? 's' : ''}.
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button onClick={handleRandomDeal} disabled={loading === 'random'} className="w-full">
              {loading === 'random' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Dealing...</>
              ) : (
                <><Shuffle className="w-4 h-4 mr-2" /> Shuffle &amp; Deal Powerups</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // DRAFT mode — active or completed → show the DraftBoard
  if (draft && (draft.status === 'ACTIVE' || draft.status === 'COMPLETED')) {
    return (
      <DraftBoard
        tournamentId={tournamentId}
        currentPlayerId={currentPlayerId}
        initialState={{
          draft,
          currentTurn,
          availablePowerups,
          players,
          powerupsPerPlayer,
          maxAttacksPerPlayer,
        }}
      />
    )
  }

  // DRAFT mode — PENDING → show order setup
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Set Draft Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Arrange the players in the order they should pick. In a{' '}
            <span className="font-semibold">{draft?.format?.toLowerCase() ?? 'snake'}</span> draft,
            the order reverses each round for fairness.
          </p>

          <div className="space-y-2">
            {order.map((playerId, idx) => {
              const player = players.find((p) => p.id === playerId)
              if (!player) return null
              return (
                <div key={playerId} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <GripVertical className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                  <span className="text-lg font-bold text-muted-foreground w-7 shrink-0 text-right">{idx + 1}</span>
                  {player.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={player.user.image} alt="" className="w-11 h-11 rounded-full shrink-0 border-2 border-border" />
                  ) : (
                    <div className="w-11 h-11 rounded-full shrink-0 border-2 border-border bg-muted flex items-center justify-center">
                      <span className="text-base font-bold text-muted-foreground">
                        {(player.user.name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-base font-semibold text-foreground flex-1 truncate">
                    {player.user.name ?? 'Player'}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => movePlayer(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-md hover:bg-muted disabled:opacity-20 transition-colors"
                    >
                      <ArrowUp className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlayer(idx, 1)}
                      disabled={idx === order.length - 1}
                      className="p-1.5 rounded-md hover:bg-muted disabled:opacity-20 transition-colors"
                    >
                      <ArrowDown className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSetOrder}
              disabled={!!loading}
              className="flex-1"
            >
              {loading === 'order' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                'Save Order'
              )}
            </Button>
            <Button
              onClick={handleStartDraft}
              disabled={!!loading}
              className="flex-1"
            >
              {loading === 'start' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Start Draft</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
