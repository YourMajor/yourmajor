'use client'

import { Card, CardContent } from '@/components/ui/card'
import { FORMATS } from '@/lib/formats/registry'
import type { FormatId } from '@/lib/formats/types'

// Free tier is restricted to the most casual formats; everything else requires a paid plan.
const FREE_FORMATS: FormatId[] = ['STROKE_PLAY', 'STABLEFORD', 'SCRAMBLE']

interface Props {
  value: FormatId
  onChange: (v: FormatId) => void
  isFree?: boolean
}

export function StepFormat({ value, onChange, isFree = false }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choose the tournament format. This controls how scoring works — individual stroke play, points-based Stableford, team Best Ball, Skins, Match Play, and more.
      </p>
      {FORMATS.filter((f) => f.id !== 'BEST_BALL' && f.id !== 'SKINS').map((f) => {
        const locked = isFree && !FREE_FORMATS.includes(f.id)
        const isTeam = f.requiresTeams
        return (
          <Card
            key={f.id}
            onClick={() => !locked && onChange(f.id)}
            className={`transition-all ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${value === f.id ? 'ring-2 ring-[var(--color-primary)] bg-[var(--color-primary)]/5' : locked ? '' : 'hover:bg-muted/40'}`}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="tournamentFormat"
                  value={f.id}
                  checked={value === f.id}
                  onChange={() => !locked && onChange(f.id)}
                  disabled={locked}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold flex flex-wrap items-center gap-2">
                    {f.label}
                    {isTeam && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Team
                      </span>
                    )}
                    {f.kind === 'match' && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Match Play
                      </span>
                    )}
                    {locked && (
                      <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        Pro / Tour
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
