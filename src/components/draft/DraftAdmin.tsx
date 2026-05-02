'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DraftBoard } from './DraftBoard'
import { DealAnimation } from './DealAnimation'
import { GripVertical, Loader2, Shuffle, Play } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

function SortablePlayerCard({ playerId, player, index }: { playerId: string; player: Player; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: playerId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
      <button type="button" {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing">
        <GripVertical className="w-5 h-5 text-muted-foreground/40 shrink-0" />
      </button>
      <span className="text-lg font-bold text-muted-foreground w-7 shrink-0 text-right">{index + 1}</span>
      {player.user.image ? (
        <Image src={player.user.image} alt="" width={44} height={44} className="w-11 h-11 rounded-full shrink-0 border-2 border-border object-cover" />
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
    </div>
  )
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
  const [order, setOrder] = useState<string[]>(() => {
    const playerIds = players.map((p) => p.id)
    const saved = (draft?.draftOrder ?? []).filter((id) => playerIds.includes(id))
    const missing = playerIds.filter((id) => !saved.includes(id))
    return [...saved, ...missing]
  })
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDealAnimation, setShowDealAnimation] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(active.id as string)
    const newIndex = order.indexOf(over.id as string)
    setOrder(arrayMove(order, oldIndex, newIndex))
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
      const orderRes = await fetch(`/api/tournaments/${tournamentId}/draft/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      })
      if (!orderRes.ok) {
        let message = 'Failed to save draft order.'
        try { const data = await orderRes.json(); if (data.error) message = data.error } catch {}
        throw new Error(message)
      }
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

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {order.map((playerId, idx) => {
                  const player = players.find((p) => p.id === playerId)
                  if (!player) return null
                  return (
                    <SortablePlayerCard key={playerId} playerId={playerId} player={player} index={idx} />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>

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
