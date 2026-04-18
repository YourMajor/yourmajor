import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      teeOptions: { orderBy: { name: 'asc' } },
      holes: { orderBy: { number: 'asc' }, include: { yardages: { include: { teeOption: true } } } },
    },
  })

  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(course)
}
