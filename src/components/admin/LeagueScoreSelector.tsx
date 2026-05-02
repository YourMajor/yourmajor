'use client'

import { useRouter } from 'next/navigation'
import { Trophy, ChevronRight } from 'lucide-react'

interface LeagueEvent {
  id: string
  slug: string
  name: string
  date: string | null
  status: 'REGISTRATION' | 'ACTIVE' | 'COMPLETED'
  isCurrent: boolean
}

interface Props {
  events: LeagueEvent[]
}

const STATUS_LABEL: Record<string, string> = {
  REGISTRATION: 'Upcoming',
  ACTIVE: 'Live',
  COMPLETED: 'Completed',
}

const STATUS_TONE: Record<string, string> = {
  REGISTRATION: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  COMPLETED: 'bg-muted text-muted-foreground',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No date set'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function LeagueScoreSelector({ events }: Props) {
  const router = useRouter()

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        No events scheduled yet. Generate a schedule from Season Management.
      </div>
    )
  }

  const current = events.find((e) => e.isCurrent)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Trophy className="w-3.5 h-3.5" />
        League events
        <span className="ml-1 text-foreground/60 normal-case font-normal">{events.length} scheduled</span>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <select
          value={current?.id ?? ''}
          onChange={(e) => {
            const next = events.find((ev) => ev.id === e.target.value)
            if (next && !next.isCurrent) {
              router.push(`/${next.slug}/admin/scores`)
            }
          }}
          className="native-select hidden lg:flex h-11 w-full bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {formatDate(ev.date)} — {ev.name} ({STATUS_LABEL[ev.status]})
            </option>
          ))}
        </select>
        <ul className="lg:hidden divide-y divide-border max-h-72 overflow-y-auto">
          {events.map((ev) => (
            <li key={ev.id}>
              <button
                onClick={() => !ev.isCurrent && router.push(`/${ev.slug}/admin/scores`)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                  ev.isCurrent ? 'bg-[var(--color-primary)]/5' : 'hover:bg-muted/40'
                }`}
                aria-current={ev.isCurrent ? 'page' : undefined}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {formatDate(ev.date)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{ev.name}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_TONE[ev.status]}`}>
                  {STATUS_LABEL[ev.status]}
                </span>
                {!ev.isCurrent && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
