'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

async function getRootTournamentId(tournamentId: string): Promise<string> {
  let currentId = tournamentId
  for (let i = 0; i < 100; i++) {
    const t = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: { id: true, parentTournamentId: true },
    })
    if (!t || !t.parentTournamentId) return currentId
    currentId = t.parentTournamentId
  }
  return currentId
}

export async function createScheduleEvent(
  tournamentId: string,
  data: { title: string; date: string; courseId?: string; notes?: string }
) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const rootId = await getRootTournamentId(tournamentId)

  await prisma.seasonScheduleEvent.create({
    data: {
      tournamentId: rootId,
      title: data.title,
      date: new Date(data.date),
      courseId: data.courseId ?? null,
      notes: data.notes ?? null,
    },
  })

  revalidatePath('/', 'layout')
}

export async function deleteScheduleEvent(eventId: string) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  await prisma.seasonScheduleEvent.delete({ where: { id: eventId } })
  revalidatePath('/', 'layout')
}

export async function submitRSVP(
  eventId: string,
  status: 'GOING' | 'NOT_GOING' | 'MAYBE'
) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  await prisma.seasonRSVP.upsert({
    where: { eventId_userId: { eventId, userId: user.id } },
    create: { eventId, userId: user.id, status },
    update: { status },
  })

  revalidatePath('/', 'layout')
}
