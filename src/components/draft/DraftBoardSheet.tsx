'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { DraftBottomSheet } from './DraftBottomSheet'
import { SlugIcon } from './CardHand'
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

interface DraftBoardSheetProps {
  open: boolean
  onClose: () => void
  picks: DraftPick[]
  players: Player[]
  draftOrder: string[]
  format: 'LINEAR' | 'SNAKE'
  picksPerPlayer: number
  currentRound: number | null
  currentPlayerId: string | null
}

function getOrderedPlayerIdsForRound(
  draftOrder: string[],
  format: 'LINEAR' | 'SNAKE',
  round: number,
): string[] {
  if (format === 'SNAKE' && round % 2 === 0) {
    return [...draftOrder].reverse()
  }
  return [...draftOrder]
}

export function DraftBoardSheet({
  open,
  onClose,
  picks,
  players,
  draftOrder,
  format,
  picksPerPlayer,
  currentRound,
  currentPlayerId,
}: DraftBoardSheetProps) {
  const totalRounds = Math.max(picksPerPlayer, 1)
  const [activeRound, setActiveRound] = useState<number>(currentRound ?? 1)
  const [lastOpen, setLastOpen] = useState<boolean>(open)

  // Snap to the live draft round when the sheet transitions closed → open.
  // Setting state during render with a guard is the documented React pattern
  // for "adjust state when a prop changes" without an effect.
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open && currentRound !== null && currentRound !== activeRound) {
      setActiveRound(currentRound)
    }
  }

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>()
    for (const p of players) m.set(p.id, p)
    return m
  }, [players])

  const playersInRoundOrder = getOrderedPlayerIdsForRound(draftOrder, format, activeRound)
  const playersPerRound = draftOrder.length || 1

  // Map of pickNumber → DraftPick
  const pickByNumber = useMemo(() => {
    const m = new Map<number, DraftPick>()
    for (const p of picks) m.set(p.pickNumber, p)
    return m
  }, [picks])

  // Pick index for round R, position i (0-based): (R-1) * playersPerRound + i + 1
  const roundStart = (activeRound - 1) * playersPerRound

  return (
    <DraftBottomSheet
      open={open}
      onClose={onClose}
      title="Draft Board"
      titleAccessory={
        <span className="text-xs font-mono text-muted-foreground">
          Round {activeRound}/{totalRounds}
        </span>
      }
    >
      {/* Round selector */}
      <div role="tablist" aria-label="Draft round" className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
          const active = r === activeRound
          const isCurrent = r === currentRound
          return (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveRound(r)}
              className={`shrink-0 min-h-9 px-3.5 rounded-full text-xs font-bold border transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : isCurrent
                    ? 'bg-[oklch(0.72_0.11_78/0.12)] text-foreground border-[oklch(0.72_0.11_78/0.40)]'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              R{r}
            </button>
          )
        })}
      </div>

      {/* Player list for this round */}
      <ul className="space-y-1.5">
        {playersInRoundOrder.map((playerId, idx) => {
          const player = playerMap.get(playerId)
          if (!player) return null
          const pickNumber = roundStart + idx + 1
          const pick = pickByNumber.get(pickNumber)
          const isOnTheClock = !pick && currentPlayerId === playerId && currentRound === activeRound
          const status: 'PICKED' | 'ON_THE_CLOCK' | 'UPCOMING' = pick
            ? 'PICKED'
            : isOnTheClock
              ? 'ON_THE_CLOCK'
              : 'UPCOMING'
          const name = player.user.name ?? 'Player'

          return (
            <li
              key={playerId}
              className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                status === 'ON_THE_CLOCK'
                  ? 'bg-[oklch(0.72_0.11_78/0.08)] border-[oklch(0.72_0.11_78/0.40)] ring-1 ring-[oklch(0.72_0.11_78/0.30)]'
                  : 'bg-card border-border'
              }`}
            >
              {/* Avatar */}
              <div className="shrink-0">
                {player.user.image ? (
                  <Image
                    src={player.user.image}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  status === 'PICKED' ? 'text-muted-foreground' :
                  status === 'ON_THE_CLOCK' ? 'text-[oklch(0.45_0.12_78)]' :
                  'text-muted-foreground/60'
                }`}>
                  {status === 'PICKED' ? 'Picked' : status === 'ON_THE_CLOCK' ? 'On the clock' : 'Upcoming'}
                </p>
              </div>

              {/* Pick (or placeholder) */}
              <div className="shrink-0 text-right max-w-[45%]">
                {pick ? (
                  <div className="flex items-center gap-1.5 justify-end">
                    <SlugIcon
                      slug={pick.powerup.slug}
                      isAttack={pick.powerup.type === 'ATTACK'}
                      className={`w-4 h-4 ${pick.powerup.type === 'ATTACK' ? 'text-red-700' : 'text-emerald-800'}`}
                    />
                    <span className={`text-xs font-bold leading-tight truncate ${
                      pick.powerup.type === 'ATTACK' ? 'text-red-800' : 'text-emerald-900'
                    }`}>
                      {pick.powerup.name}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/50">—</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </DraftBottomSheet>
  )
}
