'use client'

import { useMemo, useState, useTransition } from 'react'
import { CalendarRange } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { generateSeasonSchedule } from '@/lib/season-schedule-actions'
import { computeScheduleDates, DAYS_OF_WEEK, type DayOfWeek } from '@/lib/season-schedule'

interface Props {
  tournamentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultStartDate?: string
}

export function GenerateScheduleDialog({ tournamentId, open, onOpenChange, defaultStartDate }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(defaultStartDate ?? today)
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(2) // Tuesday default
  const [weeks, setWeeks] = useState<number>(12)
  const [skipText, setSkipText] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ generated: number; slugs: string[] } | null>(null)
  const [isPending, startTransition] = useTransition()

  const skipDates = useMemo(
    () => skipText.split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
    [skipText],
  )

  const previewDates = useMemo(
    () => computeScheduleDates(startDate, dayOfWeek, weeks, skipDates),
    [startDate, dayOfWeek, weeks, skipDates],
  )

  function reset() {
    setError('')
    setDone(null)
  }

  function handleGenerate() {
    if (previewDates.length === 0) {
      setError('No dates to generate. Adjust the start date or weeks.')
      return
    }
    if (previewDates.length > 52) {
      setError('Cap is 52 events per season.')
      return
    }
    setError('')
    startTransition(async () => {
      try {
        const result = await generateSeasonSchedule(tournamentId, {
          startDate,
          dayOfWeek,
          weeks,
          skipDates,
        })
        setDone({ generated: result.generated, slugs: result.slugs })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to generate schedule.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Generate Season Schedule</DialogTitle>
          <DialogDescription>
            Create an entire season&apos;s worth of events at once. Each generated event clones the
            most recent league event&apos;s settings (course, format, branding, handicap) and
            auto-registers active roster members.
          </DialogDescription>
        </DialogHeader>

        {!done && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs">
                <span className="font-semibold text-foreground">Start date</span>
                <input
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full px-3 py-2 rounded-lg border border-border text-sm bg-background"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-semibold text-foreground">Day of week</span>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value) as DayOfWeek)}
                  className="block w-full px-3 py-2 rounded-lg border border-border text-sm bg-background"
                >
                  {DAYS_OF_WEEK.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-semibold text-foreground">Number of weeks</span>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={weeks}
                  onChange={(e) => setWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
                  className="block w-full px-3 py-2 rounded-lg border border-border text-sm bg-background"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-semibold text-foreground">Skip dates</span>
                <input
                  type="text"
                  value={skipText}
                  onChange={(e) => setSkipText(e.target.value)}
                  placeholder="2026-07-04, 2026-09-07"
                  className="block w-full px-3 py-2 rounded-lg border border-border text-sm bg-background"
                />
              </label>
            </div>

            <div className="rounded-lg border border-border px-3 py-3 max-h-56 overflow-y-auto">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <CalendarRange className="w-3.5 h-3.5" />
                Preview · {previewDates.length} event{previewDates.length === 1 ? '' : 's'}
              </div>
              {previewDates.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Pick a start date and weeks count to preview.</p>
              ) : (
                <ol className="space-y-1 text-xs">
                  {previewDates.map((d, i) => (
                    <li key={d} className="flex justify-between gap-2 px-2 py-1 rounded hover:bg-muted/30">
                      <span className="text-muted-foreground tabular-nums">Week {i + 1}</span>
                      <span className="font-medium text-foreground tabular-nums">{d}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {done && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-green-800 dark:text-green-200">
              {done.generated} event{done.generated === 1 ? '' : 's'} created.
            </p>
            <p className="text-xs text-green-700 dark:text-green-300">
              Each event has the active roster auto-registered. Open Events tab to fine-tune individual events.
            </p>
          </div>
        )}

        <DialogFooter>
          {done ? (
            <button
              type="button"
              onClick={() => { reset(); onOpenChange(false) }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || previewDates.length === 0}
                onClick={handleGenerate}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {isPending ? `Creating ${previewDates.length}…` : `Generate ${previewDates.length} events`}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
