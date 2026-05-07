import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

// Course tee/hole data is effectively immutable after import (admins occasionally
// tweak yardages, but those edits propagate within the 24h revalidate window).
// Caching dodges a heavy multi-relation read on every leaderboard page render.
function loadCourse(id: string) {
  return unstable_cache(
    async () =>
      prisma.course.findUnique({
        where: { id },
        include: {
          teeOptions: { orderBy: { name: 'asc' } },
          holes: { orderBy: { number: 'asc' }, include: { yardages: { include: { teeOption: true } } } },
        },
      }),
    [`course-${id}`],
    { tags: [`course-${id}`, 'course-data'], revalidate: 86400 },
  )()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const course = await loadCourse(id)

  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(course)
}
