'use client'

import { useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { FORMATS, getFormat } from '@/lib/formats/registry'
import type { FormatId, FormatDef } from '@/lib/formats/types'

const HIDDEN: FormatId[] = ['BEST_BALL', 'SKINS']

type GroupKey = 'individual' | 'team' | 'match' | 'combined'

const GROUP_LABELS: Record<GroupKey, string> = {
  individual: 'Individual',
  team: 'Team',
  match: 'Match Play',
  combined: 'Combined',
}

function groupFor(f: FormatDef): GroupKey {
  if (f.kind === 'match') return 'match'
  if (f.scoringMode === 'COMBINED') return 'combined'
  if (f.requiresTeams) return 'team'
  return 'individual'
}

const HANDICAP_LABELS: Record<string, string> = {
  NONE: 'No handicap (gross only)',
  WHS: 'World Handicap System',
  STABLEFORD: 'Stableford points',
  CALLAWAY: 'Callaway (computed from round)',
  PEORIA: 'Peoria (6 secret holes)',
}

interface Props {
  defaultFormat: FormatId
  hasScores: boolean
}

export function FormatSettings({ defaultFormat, hasScores }: Props) {
  const [format, setFormat] = useState<FormatId>(defaultFormat)
  const visible = useMemo(() => FORMATS.filter((f) => !HIDDEN.includes(f.id)), [])
  const grouped = useMemo(() => {
    const out: Record<GroupKey, FormatDef[]> = { individual: [], team: [], match: [], combined: [] }
    for (const f of visible) out[groupFor(f)].push(f)
    return out
  }, [visible])

  const def = getFormat(format)
  const impliedHandicap = def.impliedHandicap ?? 'NONE'
  const handicapLabel = HANDICAP_LABELS[impliedHandicap] ?? impliedHandicap

  return (
    <div className="space-y-3">
      {hasScores && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Scores have been submitted. Changing the format would alter how the leaderboard is calculated.
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="tournamentFormat">Format</Label>
        <select
          id="tournamentFormat"
          name="tournamentFormat"
          value={format}
          onChange={(e) => setFormat(e.target.value as FormatId)}
          disabled={hasScores}
          className="native-select flex h-11 md:h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(Object.keys(grouped) as GroupKey[]).map((key) =>
            grouped[key].length === 0 ? null : (
              <optgroup key={key} label={GROUP_LABELS[key]}>
                {grouped[key].map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
        <p className="text-xs text-muted-foreground leading-snug">{def.description}</p>
      </div>
      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
        <p>
          <span className="font-medium text-foreground">Scoring:</span>{' '}
          {def.scoringMode === 'STROKE'
            ? def.supportsNet
              ? 'Stroke play (net & gross)'
              : 'Stroke play (gross)'
            : def.scoringMode === 'STABLEFORD'
              ? 'Stableford points'
              : def.scoringMode === 'MATCH'
                ? 'Match play'
                : def.scoringMode === 'SKINS'
                  ? 'Skins'
                  : def.scoringMode === 'QUOTA'
                    ? 'Quota points'
                    : 'Combined gross & net'}
        </p>
        <p>
          <span className="font-medium text-foreground">Handicap:</span> {handicapLabel}
        </p>
      </div>
    </div>
  )
}
