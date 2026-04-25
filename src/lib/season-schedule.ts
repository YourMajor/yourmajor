// Pure helpers for season schedule generation. CLIENT-SAFE — no prisma.

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * Compute the dates for a season schedule given start date, cadence, week count, and skip list.
 * `dayOfWeek` is 0 (Sun) – 6 (Sat). Returns an array of YYYY-MM-DD strings of length up to `weeks`.
 *
 * The first occurrence is the next instance of `dayOfWeek` on or after `startDate`. After that,
 * dates are weekly. Any date matching `skipDates` is dropped from the result, and we keep walking
 * until we've collected `weeks` dates (capped to a reasonable upper bound to avoid runaway loops).
 */
export function computeScheduleDates(
  startDate: string,
  dayOfWeek: DayOfWeek,
  weeks: number,
  skipDates: string[] = [],
): string[] {
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || weeks <= 0) return []

  const dayDelta = (dayOfWeek - start.getDay() + 7) % 7
  const first = new Date(start)
  first.setDate(start.getDate() + dayDelta)

  const skipSet = new Set(skipDates)
  const out: string[] = []
  const cap = Math.max(weeks * 4, 8)
  let i = 0
  while (out.length < weeks && i < cap) {
    const d = new Date(first)
    d.setDate(first.getDate() + i * 7)
    const iso = d.toISOString().slice(0, 10)
    if (!skipSet.has(iso)) out.push(iso)
    i += 1
  }
  return out
}
