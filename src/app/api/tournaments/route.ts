import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { generateJoinCode } from '@/lib/join-code'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      isOpenRegistration: true,
      primaryColor: true,
      accentColor: true,
      logo: true,
      createdAt: true,
      _count: { select: { players: true, rounds: true } },
    },
  })

  return NextResponse.json(tournaments)
}

export async function POST(request: NextRequest) {
  // Any authenticated user can create a tournament
  const creator = await getUser()
  if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, slug, primaryColor, accentColor, isOpenRegistration, startDate, endDate } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }

  try {
    const joinCode = await generateJoinCode()
    const tournament = await prisma.tournament.create({
      data: {
        name,
        joinCode,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        primaryColor: primaryColor ?? '#006747',
        accentColor: accentColor ?? '#C9A84C',
        isOpenRegistration: isOpenRegistration ?? false,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    })

    // Auto-enroll creator as admin (and player) in their own tournament
    await prisma.tournamentPlayer.create({
      data: { tournamentId: tournament.id, userId: creator.id, isAdmin: true },
    })

    return NextResponse.json(tournament, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
  }
}
