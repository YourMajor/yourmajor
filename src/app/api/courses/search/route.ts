import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { searchCourses, getCanonicalTees } from '@/lib/golf-api'

export type CourseSearchResult = {
  id: string
  name: string
  location: string | null
  par: number
  source: 'local' | 'golfcourseapi'
  // For GolfCourseAPI results: numeric course ID needed for import
  golfApiCourseId?: number
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  // 1. Search local DB first
  const localCourses = await prisma.course.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, location: true, par: true },
    take: 5,
    orderBy: { name: 'asc' },
  })

  const results: CourseSearchResult[] = localCourses.map((c) => ({
    id: c.id,
    name: c.name,
    location: c.location,
    par: c.par,
    source: 'local',
  }))

  // 2. If API key is configured, also search GolfCourseAPI.com
  if (process.env.GOLF_COURSE_API_KEY && process.env.GOLF_COURSE_API_KEY !== 'your-api-key-here') {
    try {
      const courses = await searchCourses(q)
      const localNames = new Set(localCourses.map((c) => c.name.toLowerCase()))

      for (const course of courses.slice(0, 6)) {
        const name = course.course_name || course.club_name
        if (localNames.has(name.toLowerCase())) continue

        const canonicalTees = getCanonicalTees(course)
        const par = canonicalTees[0]?.par_total ?? 72
        const loc = [course.location.city, course.location.state, course.location.country]
          .filter(Boolean).join(', ') || null

        results.push({
          id: `golfcourseapi:${course.id}`,
          name,
          location: loc,
          par,
          source: 'golfcourseapi',
          golfApiCourseId: course.id,
        })
      }
    } catch (err) {
      // API failure is non-fatal — local results still returned
      console.error('[courses/search] GolfCourseAPI error:', err)
    }
  }

  return NextResponse.json(results.slice(0, 8))
}
