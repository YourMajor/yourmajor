'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Shuffle, Users, BarChart3 } from 'lucide-react'
import { autoAssignGroups } from '@/app/[slug]/admin/groups/actions'
import type { AssignMode } from '@/lib/group-assignment'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  isLeague: boolean
  participantCount: number
  onAssigned: (result: { groupCount: number; conflicts: number }) => void
}

const MODE_OPTIONS: Array<{
  id: AssignMode
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  {
    id: 'BALANCED',
    label: 'Balanced',
    description: 'Mix high & low handicaps in every group (snake-draft).',
    icon: BarChart3,
  },
  {
    id: 'RANDOM',
    label: 'Random',
    description: 'Pure shuffle. Every player has the same odds.',
    icon: Shuffle,
  },
  {
    id: 'TIGHT',
    label: 'Flights',
    description: 'Group similar handicaps together for fair head-to-head.',
    icon: Users,
  },
]

export function GroupAutoAssignDialog({
  open,
  onOpenChange,
  tournamentId,
  isLeague,
  participantCount,
  onAssigned,
}: Props) {
  const [mode, setMode] = useState<AssignMode>('BALANCED')
  const [groupSize, setGroupSize] = useState<3 | 4>(4)
  const [avoidLastEvent, setAvoidLastEvent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const groupCount = Math.max(1, Math.ceil(participantCount / groupSize))

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await autoAssignGroups(tournamentId, mode, groupSize, avoidLastEvent)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onAssigned({ groupCount: result.groupCount, conflicts: result.conflicts })
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Groups</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">
            This replaces any existing groups for this tournament with {groupCount} new
            group{groupCount !== 1 ? 's' : ''} of up to {groupSize} players.
          </p>

          <div className="space-y-2">
            <Label>Distribution</Label>
            <div className="grid gap-2">
              {MODE_OPTIONS.map((opt) => {
                const selected = mode === opt.id
                const Icon = opt.icon
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    className={[
                      'flex items-start gap-3 rounded-lg border p-3 text-left transition-all',
                      selected
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]'
                        : 'border-border hover:border-[var(--color-primary)]/40 hover:bg-muted/40',
                    ].join(' ')}
                  >
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupSize">Group size</Label>
            <select
              id="groupSize"
              value={groupSize}
              onChange={(e) => setGroupSize(Number(e.target.value) as 3 | 4)}
              className="native-select flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
            >
              <option value={3}>Threesomes (3 players)</option>
              <option value={4}>Foursomes (4 players)</option>
            </select>
          </div>

          {isLeague && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={avoidLastEvent}
                  onChange={(e) => setAvoidLastEvent(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <div>
                  <p className="text-sm font-medium">Avoid last event&apos;s partners</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                    Try to keep this week&apos;s pairings different from the previous event.
                    May not always be solvable on small rosters.
                  </p>
                </div>
              </label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || participantCount === 0}>
            {isPending ? 'Generating…' : `Generate ${groupCount} group${groupCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
