'use client'

import { FORMATS } from '@/lib/formats/registry'
import type { FormatId, FormatDef } from '@/lib/formats/types'

// Free tier is restricted to the most casual formats; everything else requires a paid plan.
const FREE_FORMATS: FormatId[] = ['STROKE_PLAY', 'STABLEFORD', 'SCRAMBLE']

// Hide legacy enum aliases from the UI; they're kept in the registry for backwards compat.
const HIDDEN: FormatId[] = ['BEST_BALL', 'SKINS']

type GroupKey = 'individual' | 'team' | 'match' | 'combined'

const GROUP_ORDER: Array<{ key: GroupKey; label: string; description: string }> = [
  { key: 'individual', label: 'Individual', description: 'Each player for themselves.' },
  { key: 'team',       label: 'Team',       description: 'Pairs or foursomes play as one.' },
  { key: 'match',      label: 'Match',      description: 'Hole-by-hole, head-to-head.' },
  { key: 'combined',   label: 'Combined',   description: 'Two competitions in one.' },
]

function groupFor(f: FormatDef): GroupKey {
  if (f.kind === 'match') return 'match'
  if (f.scoringMode === 'COMBINED') return 'combined'
  if (f.requiresTeams) return 'team'
  return 'individual'
}

interface Props {
  value: FormatId
  onChange: (v: FormatId) => void
  isFree?: boolean
}

export function StepFormat({ value, onChange, isFree = false }: Props) {
  const visible = FORMATS.filter((f) => !HIDDEN.includes(f.id))

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Choose your format — controls how scoring works. Defaults to Stroke Play.
      </p>

      {GROUP_ORDER.map((g) => {
        const formats = visible.filter((f) => groupFor(f) === g.key)
        if (formats.length === 0) return null
        return (
          <div key={g.key} className="space-y-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </h3>
              <p className="text-[11px] text-muted-foreground/70">{g.description}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {formats.map((f) => {
                const locked = isFree && !FREE_FORMATS.includes(f.id)
                const selected = value === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => !locked && onChange(f.id)}
                    disabled={locked}
                    aria-pressed={selected}
                    className={[
                      'group relative flex flex-col items-start text-left rounded-lg border p-3 transition-all',
                      'min-h-[78px]',
                      locked
                        ? 'opacity-50 cursor-not-allowed border-border'
                        : selected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)] cursor-pointer'
                          : 'border-border hover:border-[var(--color-primary)]/40 hover:bg-muted/40 cursor-pointer',
                    ].join(' ')}
                  >
                    <span className="text-sm font-semibold leading-tight">
                      {f.label}
                    </span>
                    <span className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-2">
                      {f.description}
                    </span>
                    {locked && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Pro
                      </span>
                    )}
                    {selected && !locked && (
                      <span
                        aria-hidden
                        className="absolute top-1.5 right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-[10px] leading-none"
                      >
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
