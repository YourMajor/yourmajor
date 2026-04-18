import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getCourseById, getCanonicalTees } from '@/lib/golf-api'

/**
 * POST /api/courses/import
 * Body: { golfApiCourseId: number }
 *
 * Fetches course + hole data from GolfCourseAPI.com and persists it to the local DB.
 * Returns the local Course record. Idempotent — re-uses existing record if already imported.
 */
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { golfApiCourseId } = await req.json()
  if (!golfApiCourseId) {
    return NextResponse.json({ error: 'golfApiCourseId is required' }, { status: 400 })
  }

  const externalId = String(golfApiCourseId)

  // Return existing course if already imported
  const existing = await prisma.course.findUnique({
    where: { externalId },
    include: { teeOptions: { orderBy: { name: 'asc' } } },
  })
  if (existing) return NextResponse.json(existing)

  // Fetch from GolfCourseAPI
  const apiCourse = await getCourseById(Number(golfApiCourseId))
  const allTees = [
    ...(apiCourse.tees.male ?? []),
    ...(apiCourse.tees.female ?? []),
  ]
  const canonicalTees = getCanonicalTees(apiCourse)
  const canonicalHoles = canonicalTees[0]?.holes ?? []
  const par = canonicalTees[0]?.par_total ?? canonicalHoles.reduce((s, h) => s + h.par, 0) ?? 72
  const location = [apiCourse.location.city, apiCourse.location.state, apiCourse.location.country]
    .filter(Boolean).join(', ') || null

  const course = await prisma.$transaction(async (tx) => {
    const created = await tx.course.create({
      data: {
        externalId,
        name: apiCourse.course_name || apiCourse.club_name,
        par,
        location,
        latitude: apiCourse.location.latitude ?? null,
        longitude: apiCourse.location.longitude ?? null,
      },
    })

    if (canonicalHoles.length) {
      // Holes: par + stroke index come from the canonical tee's holes array (index = hole number - 1)
      await tx.hole.createMany({
        data: canonicalHoles.map((h, i) => ({
          courseId: created.id,
          number: i + 1,
          par: h.par,
          handicap: h.handicap ?? null,
        })),
        skipDuplicates: true,
      })

      const holeRecords = await tx.hole.findMany({ where: { courseId: created.id } })
      const holeByNumber = new Map(holeRecords.map((h) => [h.number, h.id]))

      // Create TeeOptions + yardages for every tee box (male + female)
      const yardageData: { holeId: string; teeOptionId: string; yards: number }[] = []

      for (const teeBox of allTees) {
        if (!teeBox.holes?.length) continue

        const teeOption = await tx.teeOption.create({
          data: {
            courseId: created.id,
            name: teeBox.tee_name,
            color: null,
          },
        })

        for (let i = 0; i < teeBox.holes.length; i++) {
          const holeId = holeByNumber.get(i + 1)
          if (!holeId) continue
          yardageData.push({
            holeId,
            teeOptionId: teeOption.id,
            yards: teeBox.holes[i].yardage,
          })
        }
      }

      if (yardageData.length) {
        await tx.holeYardage.createMany({ data: yardageData, skipDuplicates: true })
      }
    }

    return created
  })

  const courseWithTees = await prisma.course.findUnique({
    where: { id: course.id },
    include: { teeOptions: { orderBy: { name: 'asc' } } },
  })

  return NextResponse.json(courseWithTees, { status: 201 })
}
