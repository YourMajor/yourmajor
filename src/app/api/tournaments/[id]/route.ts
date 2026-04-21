import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const dbUser = await prisma.user.findUnique({ where: { email: user.email } })
  if (!dbUser || dbUser.role !== 'ADMIN') return null
  return dbUser
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      rounds: { include: { course: true } },
      _count: { select: { players: true } },
    },
  })
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(tournament)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  const { name, slug, primaryColor, accentColor, isOpenRegistration, startDate, endDate, status, logo } = body

  try {
    const tournament = await prisma.tournament.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') }),
        ...(primaryColor && { primaryColor }),
        ...(accentColor && { accentColor }),
        ...(isOpenRegistration !== undefined && { isOpenRegistration }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(status && { status }),
        ...(logo !== undefined && { logo }),
      },
    })
    return NextResponse.json(tournament)
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Allow global admins OR tournament admins
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser?.email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const dbUser = await prisma.user.findUnique({ where: { email: authUser.email } })
  if (!dbUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isGlobalAdmin = dbUser.role === 'ADMIN'
  if (!isGlobalAdmin) {
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: id, userId: dbUser.id } },
      select: { isAdmin: true },
    })
    if (!membership?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await prisma.tournament.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: 'Failed to delete tournament' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
