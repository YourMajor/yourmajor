'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type PowerupsState = {
  powerupsEnabled: boolean
  powerupsPerPlayer: number
  maxAttacksPerPlayer: number
  distributionMode: 'DRAFT' | 'RANDOM'
  draftFormat: 'LINEAR' | 'SNAKE'
  draftTiming: 'PRE_TOURNAMENT' | 'PRE_ROUND'
}

interface Props {
  value: PowerupsState
  onChange: (v: PowerupsState) => void
}

export function StepPowerups({ value, onChange }: Props) {
  function set<K extends keyof PowerupsState>(key: K, val: PowerupsState[K]) {
    onChange({ ...value, [key]: val })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Enable Powerup System</p>
              <p className="text-xs text-muted-foreground mt-0.5">Players draft special ability cards that can affect scoring during the tournament.</p>
            </div>
            <Switch
              checked={value.powerupsEnabled}
              onCheckedChange={(v) => set('powerupsEnabled', v)}
            />
          </div>
        </CardContent>
      </Card>

      {value.powerupsEnabled && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Powerup Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="powerupsPerPlayer">Powerups Per Player</Label>
                <Input
                  id="powerupsPerPlayer"
                  type="number"
                  min={1}
                  max={10}
                  value={value.powerupsPerPlayer}
                  onChange={(e) => set('powerupsPerPlayer', parseInt(e.target.value) || 1)}
                  className="w-24"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxAttacksPerPlayer">Max Attack Cards Per Player</Label>
                <Input
                  id="maxAttacksPerPlayer"
                  type="number"
                  min={0}
                  max={10}
                  value={value.maxAttacksPerPlayer}
                  onChange={(e) => set('maxAttacksPerPlayer', parseInt(e.target.value) || 0)}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">Limits how many attack cards each player can hold. Set to 0 for boosts only.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Distribution Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>How should powerups be distributed?</Label>
                <div className="space-y-2">
                  {([
                    { id: 'DRAFT', label: 'Draft', desc: 'Players take turns picking powerups in a live draft. More strategic and social.' },
                    { id: 'RANDOM', label: 'Random Deal', desc: 'Admin shuffles and deals powerups to each player randomly. Quick and easy.' },
                  ] as const).map((m) => (
                    <label key={m.id} className="flex items-start gap-2 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="distributionMode"
                        value={m.id}
                        checked={value.distributionMode === m.id}
                        onChange={() => set('distributionMode', m.id)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-medium">{m.label}</span>
                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {value.distributionMode === 'DRAFT' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Draft Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Draft Format</Label>
                  <div className="space-y-2">
                    {([
                      { id: 'SNAKE', label: 'Snake Draft', desc: 'Order reverses each round (1→2→3→3→2→1). Balanced for fairness.' },
                      { id: 'LINEAR', label: 'Linear Draft', desc: 'Same order every round (1→2→3→1→2→3). First pick always picks first.' },
                    ] as const).map((f) => (
                      <label key={f.id} className="flex items-start gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="draftFormat"
                          value={f.id}
                          checked={value.draftFormat === f.id}
                          onChange={() => set('draftFormat', f.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-medium">{f.label}</span>
                          <p className="text-xs text-muted-foreground">{f.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Draft Timing</Label>
                  <div className="space-y-2">
                    {([
                      { id: 'PRE_TOURNAMENT', label: 'Before tournament starts', desc: 'All powerups drafted in one session before Round 1.' },
                      { id: 'PRE_ROUND', label: 'Before each round', desc: 'Players draft new powerups before each round.' },
                    ] as const).map((t) => (
                      <label key={t.id} className="flex items-start gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="draftTiming"
                          value={t.id}
                          checked={value.draftTiming === t.id}
                          onChange={() => set('draftTiming', t.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-medium">{t.label}</span>
                          <p className="text-xs text-muted-foreground">{t.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
