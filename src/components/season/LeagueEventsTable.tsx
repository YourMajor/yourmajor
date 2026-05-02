'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Calendar, MapPin, Users, ListChecks, Activity, ArrowRight, ClipboardEdit, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteLeagueEvent } from '@/lib/league-event-actions'

export interface LeagueEventRow {
  id: string
  slug: string
  name: string
  date: string | null
  status: 'REGISTRATION' | 'ACTIVE' | 'COMPLETED'
  courseName: string | null
  roundCount: number
  participantCount: number
  groupCount: number
  scoreCount: number
  scoreCompletionPct: number
  hasGroups: boolean
  isCurrent: boolean
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  REGISTRATION: { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  ACTIVE: { label: 'Live', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  COMPLETED: { label: 'Completed', cls: 'bg-muted text-muted-foreground' },
}

function formatDate(iso: string | null): string {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Editable when there are no scores yet — i.e. the event hasn't started or has
// been live without anyone submitting. Server enforces too. Completed events
// with scores are not deletable; we still allow Edit (admin can fix metadata).
function canDelete(e: LeagueEventRow): boolean {
  return e.scoreCount === 0
}

interface Props {
  events: LeagueEventRow[]
}

export function LeagueEventsTable({ events }: Props) {
  const router = useRouter()
  const [pendingDelete, setPendingDelete] = useState<LeagueEventRow | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openDelete(event: LeagueEventRow) {
    setPendingDelete(event)
    setConfirmText('')
    setError(null)
  }

  function cancelDelete() {
    setPendingDelete(null)
    setConfirmText('')
    setError(null)
  }

  function handleDelete() {
    if (!pendingDelete) return
    setError(null)
    startTransition(async () => {
      const result = await deleteLeagueEvent(pendingDelete.id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      // If we deleted the event admin was viewing, fall back to parent / root.
      if (pendingDelete.isCurrent && result.redirectSlug) {
        router.push(`/${result.redirectSlug}/admin/season`)
      } else {
        router.refresh()
      }
      cancelDelete()
    })
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Calendar className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">No events scheduled yet</p>
        <p className="text-xs text-muted-foreground mt-1">Generate a season schedule or schedule the next event below.</p>
      </div>
    )
  }

  const totals = events.reduce(
    (acc, e) => ({
      total: acc.total + 1,
      completed: acc.completed + (e.status === 'COMPLETED' ? 1 : 0),
      active: acc.active + (e.status === 'ACTIVE' ? 1 : 0),
      upcoming: acc.upcoming + (e.status === 'REGISTRATION' ? 1 : 0),
    }),
    { total: 0, completed: 0, active: 0, upcoming: 0 },
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Full season schedule
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totals.total} event{totals.total !== 1 ? 's' : ''} · {totals.completed} completed · {totals.active} live · {totals.upcoming} upcoming
          </p>
        </div>
      </div>

      {/* Desktop: actual table. Mobile: card list (below). */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Event</th>
              <th className="text-left px-4 py-3">Course</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Players</th>
              <th className="text-right px-4 py-3">Groups</th>
              <th className="text-right px-4 py-3">Scores</th>
              <th className="text-right px-4 py-3 w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((event, idx) => {
              const badge = STATUS_BADGE[event.status]
              const deletable = canDelete(event)
              return (
                <tr
                  key={event.id}
                  className={`transition-colors ${event.status === 'ACTIVE' ? 'bg-[var(--color-primary)]/5' : 'hover:bg-muted/30'}`}
                >
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3 text-foreground tabular-nums whitespace-nowrap">{formatDate(event.date)}</td>
                  <td className="px-4 py-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link
                        href={`/${event.slug}/admin/setup`}
                        className="font-medium truncate hover:underline hover:text-[var(--color-primary)]"
                      >
                        {event.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[14rem]">
                    {event.courseName ? (
                      event.courseName
                    ) : event.status === 'COMPLETED' ? (
                      <span>—</span>
                    ) : (
                      <Link
                        href={`/${event.slug}/admin/setup#rounds`}
                        className="text-xs italic text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Set course
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {event.participantCount === 0 && event.status !== 'REGISTRATION' ? (
                      <Link
                        href={`/${event.slug}/admin/setup`}
                        className="inline-flex items-center justify-end gap-1 text-amber-600 dark:text-amber-400 hover:underline"
                        title="No players registered for an active event"
                      >
                        <AlertTriangle className="w-3 h-3" /> 0
                      </Link>
                    ) : (
                      event.participantCount
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {event.groupCount > 0 ? (
                      <span className="text-foreground">{event.groupCount}</span>
                    ) : event.participantCount > 0 && event.status !== 'COMPLETED' ? (
                      <Link
                        href={`/${event.slug}/admin/groups`}
                        className="text-xs italic text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Set up
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {event.status === 'COMPLETED' || event.scoreCount > 0 ? (
                      <span className={event.scoreCompletionPct === 100 ? 'text-green-600 dark:text-green-400' : 'text-foreground'}>
                        {event.scoreCompletionPct}%
                      </span>
                    ) : event.status === 'ACTIVE' ? (
                      <Link
                        href={`/${event.slug}/admin/scores`}
                        className="text-xs italic text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Start
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/${event.slug}/admin/groups`}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Manage groups"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/${event.slug}/admin/scores`}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Manage scores"
                      >
                        <ClipboardEdit className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/${event.slug}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
                        title="Open event leaderboard"
                      >
                        Open <ArrowRight className="w-3 h-3" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => openDelete(event)}
                        disabled={!deletable}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={deletable ? 'Delete event' : `Cannot delete — ${event.scoreCount} scores submitted`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: card list */}
      <ul className="md:hidden space-y-2">
        {events.map((event, idx) => {
          const badge = STATUS_BADGE[event.status]
          const deletable = canDelete(event)
          return (
            <li
              key={event.id}
              className={`rounded-xl border p-3 ${
                event.status === 'ACTIVE'
                  ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5'
                  : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <Link href={`/${event.slug}/admin/setup`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">#{idx + 1}</span>
                    <span className="text-sm font-medium truncate">{event.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(event.date)}
                  </p>
                  {event.courseName && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3" />
                      {event.courseName}
                    </p>
                  )}
                </Link>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                {event.participantCount === 0 && event.status !== 'REGISTRATION' ? (
                  <Link
                    href={`/${event.slug}/admin/setup`}
                    className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    <AlertTriangle className="w-3 h-3" /> 0 players
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3" /> {event.participantCount}
                  </span>
                )}
                {event.groupCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="w-3 h-3" /> {event.groupCount} groups
                  </span>
                ) : event.participantCount > 0 && event.status !== 'COMPLETED' ? (
                  <Link
                    href={`/${event.slug}/admin/groups`}
                    className="inline-flex items-center gap-1 italic hover:text-foreground hover:underline"
                  >
                    <ListChecks className="w-3 h-3" /> set up groups
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="w-3 h-3" /> no groups
                  </span>
                )}
                {event.scoreCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Activity className="w-3 h-3" /> {event.scoreCompletionPct}% scored
                  </span>
                ) : event.status === 'ACTIVE' ? (
                  <Link
                    href={`/${event.slug}/admin/scores`}
                    className="inline-flex items-center gap-1 italic hover:text-foreground hover:underline"
                  >
                    <Activity className="w-3 h-3" /> start scoring
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Activity className="w-3 h-3" /> no scores
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-border flex-wrap">
                <Link
                  href={`/${event.slug}/admin/groups`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-[var(--color-primary)]"
                >
                  <Users className="w-3 h-3" /> Groups
                </Link>
                <Link
                  href={`/${event.slug}/admin/scores`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-[var(--color-primary)]"
                >
                  <ClipboardEdit className="w-3 h-3" /> Scores
                </Link>
                <Link
                  href={`/${event.slug}`}
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-primary)]"
                >
                  Open <ArrowRight className="w-3 h-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => openDelete(event)}
                  disabled={!deletable}
                  className="inline-flex items-center gap-1 text-xs font-medium text-destructive disabled:text-muted-foreground/50"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Delete confirmation dialog */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) cancelDelete()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event?</DialogTitle>
          </DialogHeader>
          {pendingDelete && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-sm font-semibold text-foreground">{pendingDelete.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(pendingDelete.date)}</p>
                {pendingDelete.courseName && (
                  <p className="text-xs text-muted-foreground">{pendingDelete.courseName}</p>
                )}
              </div>
              <p className="text-sm text-foreground">
                This permanently removes the event, its rounds, group assignments, and registered
                players. {pendingDelete.scoreCount === 0 && pendingDelete.participantCount > 0 && (
                  <span>{pendingDelete.participantCount} registered player{pendingDelete.participantCount === 1 ? "'s registration" : "s' registrations"} will be cleared.</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Subsequent events in the season will be re-linked so the schedule stays intact.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded">delete</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || confirmText.trim().toLowerCase() !== 'delete'}
            >
              {isPending ? 'Deleting…' : 'Delete event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
