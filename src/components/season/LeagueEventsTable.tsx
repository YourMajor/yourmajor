'use client'

import Link from 'next/link'
import { Calendar, MapPin, Users, ListChecks, Activity, ArrowRight } from 'lucide-react'

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

interface Props {
  events: LeagueEventRow[]
}

export function LeagueEventsTable({ events }: Props) {
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
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((event, idx) => {
              const badge = STATUS_BADGE[event.status]
              return (
                <tr
                  key={event.id}
                  className={`transition-colors ${event.isCurrent ? 'bg-[var(--color-primary)]/5' : 'hover:bg-muted/30'}`}
                >
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3 text-foreground tabular-nums whitespace-nowrap">{formatDate(event.date)}</td>
                  <td className="px-4 py-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{event.name}</span>
                      {event.isCurrent && (
                        <span className="text-[10px] uppercase tracking-wider text-[var(--color-primary)] shrink-0">Current</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[14rem]">{event.courseName ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{event.participantCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {event.groupCount > 0 ? (
                      <span className="text-foreground">{event.groupCount}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {event.status === 'COMPLETED' || event.scoreCount > 0 ? (
                      <span className={event.scoreCompletionPct === 100 ? 'text-green-600 dark:text-green-400' : 'text-foreground'}>
                        {event.scoreCompletionPct}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/${event.slug}/admin`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                      Open <ArrowRight className="w-3 h-3" />
                    </Link>
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
          return (
            <li
              key={event.id}
              className={`rounded-xl border p-3 ${
                event.isCurrent
                  ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5'
                  : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
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
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3" /> {event.participantCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="w-3 h-3" /> {event.groupCount > 0 ? `${event.groupCount} groups` : 'no groups'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Activity className="w-3 h-3" /> {event.scoreCount > 0 ? `${event.scoreCompletionPct}% scored` : 'no scores'}
                </span>
                <Link
                  href={`/${event.slug}/admin`}
                  className="inline-flex items-center gap-0.5 font-medium text-[var(--color-primary)]"
                >
                  Open <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
