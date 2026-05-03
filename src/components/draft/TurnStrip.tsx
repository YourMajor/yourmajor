'use client'

interface TurnStripProps {
  isMyTurn: boolean
  currentPlayerName: string | null
  pickNumber: number | null
  roundNumber: number | null
  /** Number of picks until it's the viewer's turn again (null when on the clock or unknown). */
  picksUntilMine?: number | null
}

export function TurnStrip({ isMyTurn, currentPlayerName, pickNumber, roundNumber, picksUntilMine }: TurnStripProps) {
  return (
    <div
      className={`sticky top-0 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 border-b transition-colors ${
        isMyTurn
          ? 'bg-[oklch(0.72_0.11_78/0.12)] border-[oklch(0.72_0.11_78/0.40)]'
          : 'bg-card/95 backdrop-blur-sm border-border'
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center gap-2 h-9 text-xs sm:text-sm">
        {isMyTurn ? (
          <>
            <span className="relative flex items-center justify-center w-2.5 h-2.5 shrink-0">
              <span className="absolute inset-0 rounded-full bg-[oklch(0.72_0.11_78)] animate-turn-pulse" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.11_78)]" />
            </span>
            <span className="font-bold text-foreground">Your turn</span>
            {pickNumber !== null && roundNumber !== null && (
              <span className="text-muted-foreground">· Pick #{pickNumber} · Round {roundNumber}</span>
            )}
          </>
        ) : currentPlayerName ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
            <span className="text-foreground font-semibold truncate">{currentPlayerName} picking</span>
            {typeof picksUntilMine === 'number' && picksUntilMine > 0 && (
              <span className="text-muted-foreground shrink-0 ml-auto">You up in {picksUntilMine}</span>
            )}
            {pickNumber !== null && roundNumber !== null && typeof picksUntilMine !== 'number' && (
              <span className="text-muted-foreground shrink-0 ml-auto">Pick #{pickNumber} · R{roundNumber}</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Waiting for draft to start…</span>
        )}
      </div>
    </div>
  )
}
