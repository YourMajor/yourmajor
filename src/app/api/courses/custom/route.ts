import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

// `holes` bounds the Array.from() below — unbounded, a large value would spin
// the server building hole rows.
const customCourseSchema = z.object({
  name: z.string().min(1, 'Name required').max(200),
  // nullish rather than optional throughout: the client omits some of these
  // and JSON-serialises others to null, and the `?? default` fallbacks below
  // already handle both.
  par: z.number().int().min(9).max(200).nullish(),
  location: z.string().max(200).nullish(),
  holes: z.number().int().min(1).max(36).nullish(),
  holePars: z.array(z.number().int().min(1).max(10)).max(36).nullish(),
  teeName: z.string().max(100).nullish(),
  holeYardages: z.array(z.number().int().min(1).max(1000)).max(36).nullish(),
})

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = customCourseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid course data' },
      { status: 400 },
    )
  }
  const { name, par, location, holes, holePars, teeName, holeYardages } = parsed.data

  const holeCount = holes ?? 18
  const coursePar = par ?? 72
  const pars: number[] = holePars ?? Array(holeCount).fill(4)

  const course = await prisma.$transaction(async (tx) => {
    const created = await tx.course.create({
      data: {
        name,
        location: location ?? null,
        par: coursePar,
        isCustom: true,
        holes: {
          create: Array.from({ length: holeCount }, (_, i) => ({
            number: i + 1,
            par: pars[i] ?? 4,
            handicap: i + 1,
          })),
        },
      },
    })

    if (teeName && holeYardages?.length) {
      const teeOption = await tx.teeOption.create({
        data: {
          courseId: created.id,
          name: teeName,
          color: null,
        },
      })

      const holeRecords = await tx.hole.findMany({
        where: { courseId: created.id },
        orderBy: { number: 'asc' },
      })

      await tx.holeYardage.createMany({
        data: holeRecords.map((hole, i) => ({
          holeId: hole.id,
          teeOptionId: teeOption.id,
          yards: holeYardages[i] ?? 350,
        })),
      })
    }

    return created
  })

  const full = await prisma.course.findUnique({
    where: { id: course.id },
    include: {
      holes: { orderBy: { number: 'asc' } },
      teeOptions: { orderBy: { name: 'asc' } },
    },
  })

  return NextResponse.json(full)
}
