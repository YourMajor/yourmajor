'use client'

import { PowerupCard, type PowerupCardData } from './PowerupCard'

interface PickInfo {
  powerupId: string
  pickedBy: { name: string | null; image: string | null }
}

interface PowerupBrowseGridProps {
  powerups: PowerupCardData[]
  picks: PickInfo[]
  selectedId: string | null
  hasFilters: boolean
  onSelect: (p: PowerupCardData) => void
  onClearFilters: () => void
  /** Pass favouriteIds + onToggleFavorite together to render heart buttons. */
  favoriteIds?: Set<string>
  onToggleFavorite?: (powerupId: string) => void
}

export function PowerupBrowseGrid({
  powerups,
  picks,
  selectedId,
  hasFilters,
  onSelect,
  onClearFilters,
  favoriteIds,
  onToggleFavorite,
}: PowerupBrowseGridProps) {
  const pickedMap = new Map(picks.map((p) => [p.powerupId, p.pickedBy]))

  if (powerups.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        {hasFilters ? (
          <>
            <p className="text-sm font-semibold text-foreground">No powerups match these filters.</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Try widening your search.</p>
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center justify-center min-h-11 px-4 rounded-lg text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
            >
              Clear filters
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">No powerups available.</p>
            <p className="text-xs text-muted-foreground mt-1">All powerups have been drafted.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4"
      aria-label="Available powerups"
    >
      {powerups.map((powerup) => {
        const pickedBy = pickedMap.get(powerup.id) ?? null
        const isPicked = !!pickedBy
        const state = isPicked
          ? 'picked'
          : selectedId === powerup.id
            ? 'selected'
            : 'available'
        // Cards are tappable for review/favourite at any time during the draft.
        // The actual Pick action is turn-gated inside FlippableCardOverlay
        // (DraftBoard.tsx), so non-turn players can read details but the
        // Confirm Pick button stays disabled until their turn comes.
        return (
          <PowerupCard
            key={powerup.id}
            powerup={powerup}
            state={state}
            pickedBy={pickedBy}
            size="browse"
            onClick={() => { if (!isPicked) onSelect(powerup) }}
            disabled={isPicked}
            isFavorite={favoriteIds?.has(powerup.id) ?? false}
            onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(powerup.id) : undefined}
          />
        )
      })}
    </div>
  )
}
