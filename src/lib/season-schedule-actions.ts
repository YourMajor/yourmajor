'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { scheduleLeagueEvent } from '@/lib/league-event-actions'
import { computeScheduleDates, type DayOfWeek, type ScheduleFrequency } from '@/lib/season-schedule'

export interface GenerateScheduleInput {
  startDate: string                     // YYYY-MM-DD — first occurrence on or after this date
  dayOfWeek: DayOfWeek                  // 0 (Sun) – 6 (Sat)
  weeks: number                         // total events to generate (after skip-dates removed)
  skipDates?: string[]                  // YYYY-MM-DD list; matching dates are dropped
  courseId?: string                     // optional override (otherwise reuses each event's template course)
  frequency?: ScheduleFrequency         // WEEKLY (default) | BIWEEKLY | MONTHLY | CUSTOM
  intervalWeeks?: number                // weeks between events when frequency = CUSTOM
}

export interface GenerateScheduleResult {
  generated: number
  skipped: number
  slugs: string[]
}

export async function generateSeasonSchedule(
  tournamentId: string,
  input: GenerateScheduleInput,
): Promise<GenerateScheduleResult> {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { isAdmin: true },
  })
  if (!membership?.isAdmin && user.role !== 'ADMIN') {
    throw new Error('Only admins can generate a season schedule.')
  }

  const dates = computeScheduleDates(
    input.startDate,
    input.dayOfWeek,
    input.weeks,
    input.skipDates ?? [],
    { frequency: input.frequency, intervalWeeks: input.intervalWeeks },
  )
  if (dates.length === 0) {
    throw new Error('No valid dates generated. Check the start date and cadence inputs.')
  }
  if (dates.length > 52) {
    throw new Error('A season schedule is capped at 52 events.')
  }

  // We delegate per-event creation to scheduleLeagueEvent which walks
  // getLatestInChain → so calling it sequentially with the same tournamentId
  // produces a properly-linked chain (each new event chains off the previous).
  const slugs: string[] = []
  for (const date of dates) {
    const result = await scheduleLeagueEvent(tournamentId, {
      date,
      courseId: input.courseId,
    })
    slugs.push(result.slug)
  }

  // Each scheduleLeagueEvent call already revalidated its own slug + the
  // league root. We just need to make sure the originating tournament's
  // pages reflect the new chain length.
  const origin = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { slug: true },
  })
  if (origin?.slug) revalidatePath(`/${origin.slug}`, 'layout')

  return {
    generated: slugs.length,
    skipped: (input.skipDates?.length ?? 0),
    slugs,
  }
}
