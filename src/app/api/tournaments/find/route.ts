import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  const tournament = await prisma.tournament.findUnique({
    where: { joinCode: code },
    select: {
      slug: true,
      name: true,
      tournamentType: true,
      status: true,
    },
  })

  if (!tournament || tournament.tournamentType === 'INVITE') {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  }

  return NextResponse.json({ slug: tournament.slug, name: tournament.name, status: tournament.status })
}
