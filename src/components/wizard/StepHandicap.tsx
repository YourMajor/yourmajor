'use client'

import { Card, CardContent } from '@/components/ui/card'

const SYSTEMS = [
  {
    id: 'NONE' as const,
    name: 'No Handicap (Gross Only)',
    description: 'Pure stroke play. No handicap adjustments — lowest gross score wins. Best for groups of similar ability or casual rounds.',
  },
  {
    id: 'WHS' as const,
    name: 'World Handicap System (WHS)',
    description: 'The internationally recognized standard. Handicap calculated from rounds played in-app, or set via admin override. Net score = gross minus course handicap.',
  },
  {
    id: 'STABLEFORD' as const,
    name: 'Stableford',
    description: 'Points-based scoring. Players earn points per hole based on their score relative to par and their handicap. Higher points = better. Great for mixed-ability groups.',
  },
  {
    id: 'CALLAWAY' as const,
    name: 'Callaway System',
    description: 'Ideal for one-time events. No pre-established handicap required — it\'s calculated from the player\'s worst holes within their own round.',
  },
  {
    id: 'PEORIA' as const,
    name: 'Peoria System',
    description: 'Six holes are secretly selected before the round. After play, handicap is calculated based on those holes only. Prevents sandbagging in casual events.',
  },
] as const

type HandicapSystem = typeof SYSTEMS[number]['id']

interface Props {
  value: HandicapSystem
  onChange: (v: HandicapSystem) => void
  isFree?: boolean
}

export function StepHandicap({ value, onChange, isFree = false }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose the handicap system for this tournament. This determines how net scores are calculated.</p>
      {SYSTEMS.map((s) => {
        const locked = isFree && s.id !== 'NONE'
        return (
          <Card
            key={s.id}
            onClick={() => !locked && onChange(s.id)}
            className={`transition-all ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${value === s.id ? 'ring-2 ring-[var(--color-primary)] bg-[var(--color-primary)]/5' : locked ? '' : 'hover:bg-muted/40'}`}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="handicapSystem"
                  value={s.id}
                  checked={value === s.id}
                  onChange={() => !locked && onChange(s.id)}
                  disabled={locked}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold">
                    {s.name}
                    {locked && <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Pro / Tour</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
