'use client'

import Image from 'next/image'
import { Hand, ListOrdered } from 'lucide-react'

interface DraftPeekBarProps {
  isMyTurn: boolean
  currentPlayerName: string | null
  currentPlayerImage: string | null
  picksUntilMine: number | null
  handCount: number
  onOpenHand: () => void
  onOpenBoard: () => void
}

export function DraftPeekBar({
  isMyTurn,
  currentPlayerName,
  currentPlayerImage,
  picksUntilMine,
  handCount,
  onOpenHand,
  onOpenBoard,
}: DraftPeekBarProps) {
  return (
    <div
      className="fixed left-0 right-0 z-40 lg:hidden bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      style={{ bottom: 'calc(var(--nav-bottom-height, 64px) + env(safe-area-inset-bottom, 0px))' }}
      role="region"
      aria-label="Draft actions"
    >
      <div className="flex items-center gap-2 h-14 px-3">
        {/* Turn context */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isMyTurn ? (
            <>
              <span className="relative flex items-center justify-center w-2.5 h-2.5 shrink-0">
                <span className="absolute inset-0 rounded-full bg-[oklch(0.72_0.11_78)] animate-turn-pulse" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.11_78)]" />
              </span>
              <span className="text-xs font-bold text-foreground">Your turn</span>
            </>
          ) : currentPlayerName ? (
            <>
              {currentPlayerImage ? (
                <Image
                  src={currentPlayerImage}
                  alt=""
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                  {currentPlayerName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate leading-tight">{currentPlayerName}</p>
                {typeof picksUntilMine === 'number' && picksUntilMine > 0 ? (
                  <p className="text-[10px] text-muted-foreground leading-tight">You up in {picksUntilMine}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground leading-tight">Picking…</p>
                )}
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Waiting…</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenHand}
            aria-label={`Open your hand, ${handCount} card${handCount === 1 ? '' : 's'}`}
            className="relative flex items-center gap-1.5 min-h-11 px-3 rounded-lg bg-muted hover:bg-muted/70 text-foreground transition-colors"
          >
            <Hand className="w-4 h-4" />
            <span className="text-xs font-semibold">Hand</span>
            {handCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {handCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenBoard}
            aria-label="Open draft board"
            className="flex items-center gap-1.5 min-h-11 px-3 rounded-lg bg-muted hover:bg-muted/70 text-foreground transition-colors"
          >
            <ListOrdered className="w-4 h-4" />
            <span className="text-xs font-semibold">Board</span>
          </button>
        </div>
      </div>
    </div>
  )
}
