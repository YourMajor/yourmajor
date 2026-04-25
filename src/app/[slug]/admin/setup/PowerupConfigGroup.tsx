'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  defaultEnabled: boolean
  defaultPerPlayer: number
  defaultMaxAttacks: number
  defaultDistMode: 'DRAFT' | 'RANDOM'
  locked: boolean
}

export function PowerupConfigGroup({
  defaultEnabled,
  defaultPerPlayer,
  defaultMaxAttacks,
  defaultDistMode,
  locked,
}: Props) {
  const [enabled, setEnabled] = useState(defaultEnabled)

  return (
    <div className="space-y-4">
      {locked && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Powerups have already been drafted or dealt. These settings are locked to prevent data inconsistencies.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="powerupsEnabled">Enable Powerups</Label>
          <p className="text-xs text-muted-foreground">
            Players draft cards that modify scores during the round.
          </p>
        </div>
        <input
          id="powerupsEnabled"
          name="powerupsEnabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={locked}
          className="h-4 w-4 disabled:opacity-50"
        />
      </div>

      {enabled && (
        <div className="space-y-4 pt-2 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="powerupsPerPlayer">Powerups Per Player</Label>
              <Input
                id="powerupsPerPlayer"
                name="powerupsPerPlayer"
                type="number"
                min={1}
                max={10}
                defaultValue={defaultPerPlayer}
                disabled={locked}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxAttacksPerPlayer">Max Attack Cards</Label>
              <Input
                id="maxAttacksPerPlayer"
                name="maxAttacksPerPlayer"
                type="number"
                min={0}
                max={10}
                defaultValue={defaultMaxAttacks}
                disabled={locked}
                className="w-full"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="distributionMode">Distribution Method</Label>
            <select
              id="distributionMode"
              name="distributionMode"
              defaultValue={defaultDistMode}
              disabled={locked}
              className="native-select flex h-11 md:h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="DRAFT">Draft (players pick in order)</option>
              <option value="RANDOM">Random Deal</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
