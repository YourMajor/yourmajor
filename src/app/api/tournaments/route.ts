import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { generateJoinCode } from '@/lib/join-code'

// No GET here on purpose. There used to be one that returned every Tournament
// row to any authenticated user with no visibility filter — it had no callers
// anywhere in src/, so it was deleted rather than scoped. If a listing
// endpoint is needed later, filter it to the caller's own memberships; see
// tournaments/nearby for the PUBLIC-only variant.

export async function POST(request: NextRequest) {
  // Any authenticated user can create a tournament
  const creator = await getUser()
  if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, slug, primaryColor, accentColor, isOpenRegistration, startDate, endDate } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }

  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
  if ((primaryColor && !HEX_COLOR.test(primaryColor)) || (accentColor && !HEX_COLOR.test(accentColor))) {
    return NextResponse.json({ error: 'Colors must be #RRGGBB' }, { status: 400 })
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
