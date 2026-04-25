'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { scheduleLeagueEvent } from '@/lib/league-event-actions'
import { computeScheduleDates, type DayOfWeek } from '@/lib/season-schedule'

export interface GenerateScheduleInput {
  startDate: string                     // YYYY-MM-DD — first occurrence on or after this date
  dayOfWeek: DayOfWeek                  // 0 (Sun) – 6 (Sat)
  weeks: number                         // total events to generate (after skip-dates removed)
  skipDates?: string[]                  // YYYY-MM-DD list; matching dates are dropped
  courseId?: string                     // optional override (otherwise reuses each event's template course)
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

  const dates = computeScheduleDates(input.startDate, input.dayOfWeek, input.weeks, input.skipDates ?? [])
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

  revalidatePath('/', 'layout')

  return {
    generated: slugs.length,
    skipped: (input.skipDates?.length ?? 0),
    slugs,
  }
}
