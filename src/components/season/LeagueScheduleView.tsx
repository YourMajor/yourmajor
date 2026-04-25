'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, Check, X, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { setEventParticipation } from '@/app/[slug]/season/actions'

export interface ScheduleEvent {
  id: string
  slug: string
  name: string
  date: string | null
  status: 'REGISTRATION' | 'ACTIVE' | 'COMPLETED'
  /** Current user's participation state, or null if no TournamentPlayer row exists. */
  myParticipation: boolean | null
  /** True when the current user has scores in this event — disables unregister. */
  hasScores: boolean
}

interface Props {
  events: ScheduleEvent[]
  isAuthenticated: boolean
  onRoster: boolean
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  REGISTRATION: { label: 'Upcoming', variant: 'outline' },
  ACTIVE: { label: 'Live', variant: 'default' },
  COMPLETED: { label: 'Complete', variant: 'secondary' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Date TBD'
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function LeagueScheduleView({ events, isAuthenticated, onRoster }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localState, setLocalState] = useState<Record<string, boolean | null>>({})

  function getParticipation(event: ScheduleEvent): boolean | null {
    return localState[event.id] !== undefined ? localState[event.id] : event.myParticipation
  }

  function handleToggle(event: ScheduleEvent, going: boolean) {
    setError(null)
    setPendingId(event.id)
    setLocalState((prev) => ({ ...prev, [event.id]: going }))

    startTransition(async () => {
      const result = await setEventParticipation(event.id, going)
      if (!result.ok) {
        setError(result.error)
        setLocalState((prev) => {
          const next = { ...prev }
          delete next[event.id]
          return next
        })
      } else {
        router.refresh()
      }
      setPendingId(null)
    })
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
        <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">No events scheduled yet</p>
        <p className="text-xs text-muted-foreground mt-1">Check back once your league admin generates the season schedule.</p>
      </div>
    )
  }

  const upcoming = events.filter((e) => e.status !== 'COMPLETED')
  const completed = events.filter((e) => e.status === 'COMPLETED')

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Upcoming · {upcoming.length}
          </p>
          {upcoming.map((event) => {
            const participation = getParticipation(event)
            const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.REGISTRATION
            const isLoading = isPending && pendingId === event.id
            const canUnregister = participation !== false && !event.hasScores

            return (
              <div
                key={event.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border px-5 py-4 transition-all hover:border-[var(--color-primary)]/40"
              >
                <Link href={`/${event.slug}`} className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{event.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(event.date)}
                  </p>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {isAuthenticated && event.status !== 'COMPLETED' && (
                    <ParticipationToggle
                      participation={participation}
                      onGoing={() => handleToggle(event, true)}
                      onSkip={() => handleToggle(event, false)}
                      canUnregister={canUnregister}
                      onRoster={onRoster}
                      isLoading={isLoading}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Completed · {completed.length}
          </p>
          {completed.map((event) => (
            <Link
              key={event.id}
              href={`/${event.slug}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-border px-5 py-3 transition-all hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{event.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(event.date)}</p>
              </div>
              <Badge variant="secondary">
                <Trophy className="w-3 h-3 mr-1" />
                Results
              </Badge>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}

function ParticipationToggle({
  participation,
  onGoing,
  onSkip,
  canUnregister,
  onRoster,
  isLoading,
}: {
  participation: boolean | null
  onGoing: () => void
  onSkip: () => void
  canUnregister: boolean
  onRoster: boolean
  isLoading: boolean
}) {
  // States:
  //  - participation === true  → "I'm in" (registered)
  //  - participation === false → "Skipping" (opted out)
  //  - participation === null  → not on roster, no record yet ("Register")

  if (participation === true) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onSkip}
        disabled={isLoading || !canUnregister}
        title={!canUnregister ? "You've already entered scores for this event" : 'Skip this event'}
      >
        <Check className="w-3.5 h-3.5 mr-1 text-green-600" />
        {isLoading ? '…' : "I'm in"}
      </Button>
    )
  }

  if (participation === false) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onGoing}
        disabled={isLoading}
      >
        <X className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
        {isLoading ? '…' : 'Skipping'}
      </Button>
    )
  }

  // null — not registered yet
  return (
    <Button
      variant="default"
      size="sm"
      onClick={onGoing}
      disabled={isLoading}
    >
      {isLoading ? 'Registering…' : onRoster ? "Mark me in" : 'Register'}
    </Button>
  )
}
