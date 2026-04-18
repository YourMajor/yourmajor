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

  const tees = await prisma.teeOption.findMany({
    where: { courseId: id },
    select: { id: true, name: true, color: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(tees)
}
