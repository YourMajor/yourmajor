'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { PowerupCard, type PowerupCardData } from './PowerupCard'
import { PowerupFilterBar, type PowerupTypeFilter, type PowerupSortKey } from './PowerupFilterBar'
import { matchesDurationFilter, type DurationFilter } from '@/lib/draft-utils'
import { togglePowerupFavorite } from '@/app/[slug]/draft/actions'
import { buttonVariants } from '@/components/ui/button-variants'

interface PreDraftPowerupPreviewProps {
  powerups: PowerupCardData[]
  initialFavoriteIds: string[]
  heading: string
  description: string
  backHref: string
  adminCta?: { href: string; label: string }
}

export function PreDraftPowerupPreview({
  powerups,
  initialFavoriteIds,
  heading,
  description,
  backHref,
  adminCta,
}: PreDraftPowerupPreviewProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<PowerupTypeFilter>('ALL')
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('ALL')
  const [sortBy, setSortBy] = useState<PowerupSortKey>('DEFAULT')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(initialFavoriteIds),
  )

  const handleToggleFavorite = useCallback(async (powerupId: string) => {
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

  const counts = useMemo(() => {
    let boost = 0
    let attack = 0
    for (const p of powerups) {
      if (p.type === 'BOOST') boost++
      else if (p.type === 'ATTACK') attack++
    }
    return { ALL: boost + attack, BOOST: boost, ATTACK: attack }
  }, [powerups])

  const durationCounts = useMemo(() => {
    let single = 0
    let multi = 0
    for (const p of powerups) {
      if (p.effect.duration === 1) single++
      else multi++
    }
    return { ALL: single + multi, SINGLE: single, MULTI: multi }
  }, [powerups])

  const favoriteCount = useMemo(
    () => powerups.reduce((n, p) => n + (favoriteIds.has(p.id) ? 1 : 0), 0),
    [powerups, favoriteIds],
  )

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = powerups.filter((powerup) => {
      if (favoritesOnly && !favoriteIds.has(powerup.id)) return false
      if (typeFilter !== 'ALL' && powerup.type !== typeFilter) return false
      if (!matchesDurationFilter(powerup.effect.duration, durationFilter)) return false
      if (q && !(powerup.name.toLowerCase().includes(q) || powerup.description.toLowerCase().includes(q))) return false
      return true
    })
    matches.sort((a, b) => {
      switch (sortBy) {
        case 'POWER_DESC': {
          const aMod = a.effect.scoring?.modifier
          const bMod = b.effect.scoring?.modifier
          const aImpact = aMod == null ? -Infinity : Math.abs(aMod)
          const bImpact = bMod == null ? -Infinity : Math.abs(bMod)
          if (aImpact !== bImpact) return bImpact - aImpact
          return a.name.localeCompare(b.name)
        }
        case 'DURATION_ASC': {
          const aBucket = a.effect.duration === 1 ? 0 : 1
          const bBucket = b.effect.duration === 1 ? 0 : 1
          if (aBucket !== bBucket) return aBucket - bBucket
          return a.name.localeCompare(b.name)
        }
        case 'DEFAULT':
        default: {
          if (a.type !== b.type) return a.type === 'BOOST' ? -1 : 1
          return a.name.localeCompare(b.name)
        }
      }
    })
    return matches
  }, [powerups, search, typeFilter, durationFilter, sortBy, favoritesOnly, favoriteIds])

  const hasFilters = search.trim().length > 0 || typeFilter !== 'ALL' || durationFilter !== 'ALL' || favoritesOnly

  return (
    <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 space-y-4">
      {/* Inline waiting banner instead of a full-page interstitial so the
          catalog stays visible below it. */}
      <div className="rounded-2xl border border-border bg-card/60 px-4 py-5 sm:px-6 sm:py-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
        <div className="relative shrink-0">
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ backgroundColor: 'var(--color-primary, var(--primary))' }}
          />
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, var(--primary)) 10%, transparent)' }}
          >
            <Clock className="w-5 h-5" style={{ color: 'var(--color-primary, var(--primary))' }} />
          </div>
        </div>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">{heading}</h1>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
          <p className="text-xs text-muted-foreground/80 mt-2">
            Browse the powerup pool below — tap the heart on any card to favourite it for the draft.
          </p>
        </div>
        {adminCta && (
          <Link
            href={adminCta.href}
            className={
              buttonVariants({ size: 'sm' }) +
              ' shrink-0 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'
            }
          >
            {adminCta.label}
          </Link>
        )}
      </div>

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

      {filteredAndSorted.length === 0 ? (
        <div className="text-center py-12 px-4">
          {hasFilters ? (
            <>
              <p className="text-sm font-semibold text-foreground">No powerups match these filters.</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Try widening your search.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setTypeFilter('ALL')
                  setDurationFilter('ALL')
                  setFavoritesOnly(false)
                }}
                className="inline-flex items-center justify-center min-h-11 px-4 rounded-lg text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">No powerups configured.</p>
              <p className="text-xs text-muted-foreground mt-1">The admin hasn&apos;t selected any powerups for this tournament yet.</p>
            </>
          )}
        </div>
      ) : (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4"
          aria-label="Powerup pool"
        >
          {filteredAndSorted.map((powerup) => (
            <PowerupCard
              key={powerup.id}
              powerup={powerup}
              size="browse"
              // Card-tap is a no-op pre-draft; only the heart is interactive.
              // Passing `disabled` keeps the card-button truly inert without
              // dimming, since we override styling above.
              onClick={undefined}
              isFavorite={favoriteIds.has(powerup.id)}
              onToggleFavorite={() => handleToggleFavorite(powerup.id)}
            />
          ))}
        </div>
      )}

      <div className="text-center pt-2">
        <Link
          href={backHref}
          className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' text-muted-foreground'}
        >
          &larr; Back to Leaderboard
        </Link>
      </div>
    </main>
  )
}
