// Pure helpers for season schedule generation. CLIENT-SAFE — no prisma.

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type ScheduleFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM'

export interface ScheduleOptions {
  frequency?: ScheduleFrequency
  /** Number of weeks between events when frequency = 'CUSTOM'. Ignored otherwise. */
  intervalWeeks?: number
}

/**
 * Compute the dates for a season schedule given start date, cadence, count, and skip list.
 * `dayOfWeek` is 0 (Sun) – 6 (Sat). Returns an array of YYYY-MM-DD strings of length up to `weeks`.
 *
 * The first occurrence is the next instance of `dayOfWeek` on or after `startDate`. Subsequent
 * dates depend on `options.frequency`:
 *   - WEEKLY (default)  — every 7 days
 *   - BIWEEKLY          — every 14 days
 *   - MONTHLY           — same nth weekday of each month (e.g. "every 2nd Saturday").
 *                         Falls back to last weekday of the month when the nth doesn't exist.
 *   - CUSTOM            — every `intervalWeeks * 7` days
 *
 * Any date matching `skipDates` is dropped; the loop keeps walking until `weeks` dates are
 * collected (capped at a sane upper bound to avoid runaway).
 */
export function computeScheduleDates(
  startDate: string,
  dayOfWeek: DayOfWeek,
  weeks: number,
  skipDates: string[] = [],
  options: ScheduleOptions = {},
): string[] {
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || weeks <= 0) return []

  const frequency: ScheduleFrequency = options.frequency ?? 'WEEKLY'
  const intervalWeeks = Math.max(1, options.intervalWeeks ?? 1)

  const dayDelta = (dayOfWeek - start.getDay() + 7) % 7
  const first = new Date(start)
  first.setDate(start.getDate() + dayDelta)

  const stepDays =
    frequency === 'WEEKLY' ? 7 :
    frequency === 'BIWEEKLY' ? 14 :
    frequency === 'CUSTOM' ? intervalWeeks * 7 :
    null // MONTHLY handled separately

  // For MONTHLY: anchor on which Nth weekday-of-month the first event falls.
  const firstNth = Math.ceil(first.getDate() / 7)

  const skipSet = new Set(skipDates)
  const out: string[] = []
  const cap = Math.max(weeks * 4, 24)
  let i = 0
  while (out.length < weeks && i < cap) {
    let d: Date
    if (stepDays !== null) {
      d = new Date(first)
      d.setDate(first.getDate() + i * stepDays)
    } else {
      // MONTHLY — find the Nth `dayOfWeek` of the month i months after `first`.
      const targetMonth = first.getMonth() + i
      const targetYear = first.getFullYear() + Math.floor(targetMonth / 12)
      const monthIdx = ((targetMonth % 12) + 12) % 12
      const firstOfMonth = new Date(targetYear, monthIdx, 1)
      const offsetToFirstWeekday = (dayOfWeek - firstOfMonth.getDay() + 7) % 7
      const firstWeekdayDate = 1 + offsetToFirstWeekday
      const candidateDate = firstWeekdayDate + (firstNth - 1) * 7
      // If the Nth weekday doesn't exist this month (e.g. 5th Saturday in Feb), fall back one.
      const lastDayOfMonth = new Date(targetYear, monthIdx + 1, 0).getDate()
      const finalDate = candidateDate > lastDayOfMonth ? candidateDate - 7 : candidateDate
      d = new Date(targetYear, monthIdx, finalDate)
    }
    const iso = d.toISOString().slice(0, 10)
    if (!skipSet.has(iso)) out.push(iso)
    i += 1
  }
  return out
}
