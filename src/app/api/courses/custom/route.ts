import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, par, location, holes, holePars, teeName, holeYardages } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

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
