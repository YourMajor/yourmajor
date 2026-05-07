'use client'

import { Search, X } from 'lucide-react'
import type { DurationFilter } from '@/lib/draft-utils'

export type PowerupTypeFilter = 'ALL' | 'BOOST' | 'ATTACK'
export type PowerupSortKey = 'DEFAULT' | 'POWER_DESC' | 'DURATION_ASC'

interface PowerupFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  typeFilter: PowerupTypeFilter
  onTypeFilterChange: (value: PowerupTypeFilter) => void
  durationFilter: DurationFilter
  onDurationFilterChange: (value: DurationFilter) => void
  sortBy: PowerupSortKey
  onSortChange: (value: PowerupSortKey) => void
  /** Counts shown next to each chip; pass undefined to hide. */
  counts?: { ALL: number; BOOST: number; ATTACK: number }
  durationCounts?: { ALL: number; SINGLE: number; MULTI: number }
}

const TYPES: { value: PowerupTypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'BOOST', label: 'Boost' },
  { value: 'ATTACK', label: 'Attack' },
]

const DURATIONS: { value: DurationFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SINGLE', label: '1H' },
  { value: 'MULTI', label: 'Multi' },
]

const SORTS: { value: PowerupSortKey; label: string }[] = [
  { value: 'DEFAULT', label: 'Default' },
  { value: 'POWER_DESC', label: 'Power: high → low' },
  { value: 'DURATION_ASC', label: 'Duration: 1H first' },
]

export function PowerupFilterBar({ search, onSearchChange, typeFilter, onTypeFilterChange, durationFilter, onDurationFilterChange, sortBy, onSortChange, counts, durationCounts }: PowerupFilterBarProps) {
  return (
    <div className="sticky top-9 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-background/95 backdrop-blur-sm border-b border-border space-y-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          role="searchbox"
          aria-label="Search powerups"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search powerups"
          className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-9 py-2 text-sm shadow-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Type segmented control */}
      <div role="tablist" aria-label="Filter by powerup type" className="flex gap-1.5 p-1 rounded-lg bg-muted">
        {TYPES.map((t) => {
          const active = typeFilter === t.value
          const count = counts?.[t.value]
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onTypeFilterChange(t.value)}
              className={`flex-1 min-h-9 px-3 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{t.label}</span>
              {typeof count === 'number' && (
                <span className={`ml-1.5 text-[10px] font-mono ${active ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Duration segmented control */}
      <div role="tablist" aria-label="Filter by duration" className="flex gap-1.5 p-1 rounded-lg bg-muted">
        {DURATIONS.map((d) => {
          const active = durationFilter === d.value
          const count = durationCounts?.[d.value]
          return (
            <button
              key={d.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onDurationFilterChange(d.value)}
              className={`flex-1 min-h-9 px-3 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{d.label}</span>
              {typeof count === 'number' && (
                <span className={`ml-1.5 text-[10px] font-mono ${active ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Sort dropdown */}
      <div className="flex items-center gap-2">
        <label htmlFor="powerup-sort" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sort
        </label>
        <select
          id="powerup-sort"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as PowerupSortKey)}
          className="flex-1 h-8 rounded-md border border-input bg-card px-2 text-xs sm:text-sm font-medium text-foreground shadow-sm transition-colors outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
