'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, isTournamentAdmin } from '@/lib/auth'

const setRoundCourseSchema = z.object({
  roundId: z.string().min(1),
  courseId: z.string().min(1),
})

export type SetRoundCourseResult =
  | { ok: true }
  | { ok: false; error: string }

export async function setEventRoundCourse(
  input: { roundId: string; courseId: string },
): Promise<SetRoundCourseResult> {
  const user = await requireAuth()
  const parsed = setRoundCourseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request' }

  const round = await prisma.tournamentRound.findUnique({
    where: { id: parsed.data.roundId },
    select: { id: true, tournamentId: true, courseId: true, tournament: { select: { slug: true } } },
  })
  if (!round) return { ok: false, error: 'Round not found' }

  if (!(await isTournamentAdmin(user.id, round.tournamentId))) {
    return { ok: false, error: 'Forbidden' }
  }

  const course = await prisma.course.findUnique({
    where: { id: parsed.data.courseId },
    select: { id: true },
  })
  if (!course) return { ok: false, error: 'Course not found' }

  // Block course change once any score has been recorded for this round —
  // existing scores reference holes on the previous course.
  const scoreCount = await prisma.score.count({ where: { roundId: round.id } })
  if (scoreCount > 0) {
    return { ok: false, error: 'Cannot change course after scores have been recorded' }
  }

  if (round.courseId === parsed.data.courseId) {
    return { ok: true }
  }

  // Switching course invalidates any per-hole tee assignments tied to the old
  // course's TeeOptions. Clear them; admin can re-pick custom tees if desired.
  await prisma.$transaction([
    prisma.roundHoleTee.deleteMany({ where: { roundId: round.id } }),
    prisma.roundPlayerTee.deleteMany({ where: { roundId: round.id } }),
    prisma.tournamentRound.update({
      where: { id: round.id },
      data: { courseId: parsed.data.courseId, teeMode: 'UNIFORM' },
    }),
  ])

  revalidatePath(`/${round.tournament.slug}`, 'layout')
  revalidatePath(`/${round.tournament.slug}/admin/setup`)

  return { ok: true }
}
