'use client'

import { DraftBottomSheet } from './DraftBottomSheet'
import { PowerupCard, type PowerupCardData } from './PowerupCard'

interface PowerupHandSheetProps {
  open: boolean
  onClose: () => void
  cards: Array<{ powerupId: string; powerup: PowerupCardData }>
  onSelectCard?: (powerup: PowerupCardData) => void
}

export function PowerupHandSheet({ open, onClose, cards, onSelectCard }: PowerupHandSheetProps) {
  const count = cards.length

  return (
    <DraftBottomSheet
      open={open}
      onClose={onClose}
      title="Your Hand"
      titleAccessory={
        <span className="text-xs font-mono text-muted-foreground">{count} card{count === 1 ? '' : 's'}</span>
      }
    >
      {count === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm font-semibold text-foreground">No powerups in hand yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Cards you draft will appear here.</p>
        </div>
      ) : (
        <div className="-mx-5 px-5 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
          <div className="flex gap-3 pb-2">
            {cards.map((c) => (
              <div
                key={c.powerupId}
                className="snap-center shrink-0 w-[44vw] max-w-[200px]"
              >
                <PowerupCard
                  powerup={c.powerup}
                  state="owned"
                  size="browse"
                  onClick={onSelectCard ? () => onSelectCard(c.powerup) : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </DraftBottomSheet>
  )
}
