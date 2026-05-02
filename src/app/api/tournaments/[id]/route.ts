import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
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
  // Never leak joinCode on a public endpoint — it's used as an invite secret.
  const { joinCode: _joinCode, ...safe } = tournament
  void _joinCode
  return NextResponse.json(safe)
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

  // The Tournament self-relation (parentTournamentId → TournamentRenewal) has
  // no onDelete cascade in the schema. For a non-root, re-link direct children
  // to the deleted tournament's parent so the chain stays intact. For a root,
  // delete the entire chain leaves-first — re-linking children to null would
  // turn each into an orphan root that shows up as a separate league card.
  const target = await prisma.tournament.findUnique({
    where: { id },
    select: { parentTournamentId: true, slug: true },
  })
  if (!target) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  try {
    if (target.parentTournamentId === null) {
      // Root — collect all descendants via BFS, then delete deepest-first.
      const allIds: string[] = [id]
      let frontier = [id]
      for (let i = 0; i < 200 && frontier.length > 0; i++) {
        const children = await prisma.tournament.findMany({
          where: { parentTournamentId: { in: frontier } },
          select: { id: true },
        })
        if (children.length === 0) break
        const ids = children.map((c) => c.id)
        allIds.push(...ids)
        frontier = ids
      }
      await prisma.$transaction(async (tx) => {
        for (const tid of [...allIds].reverse()) {
          await tx.tournament.delete({ where: { id: tid } })
        }
      })
    } else {
      // Non-root — re-link children to grandparent, then delete this event only.
      await prisma.$transaction(async (tx) => {
        await tx.tournament.updateMany({
          where: { parentTournamentId: id },
          data: { parentTournamentId: target.parentTournamentId },
        })
        await tx.tournament.delete({ where: { id } })
      })
    }
  } catch (e) {
    // Surface the actual error so admins can see what failed (FK constraint,
    // etc.) instead of a generic 500.
    const message = e instanceof Error ? e.message : 'Failed to delete tournament'
    console.error('[DELETE /api/tournaments/:id]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Bust caches for any page that lists tournaments — without this the dashboard
  // server-renders a stale list and the deleted tournament keeps appearing.
  revalidatePath('/dashboard')
  revalidatePath('/tournaments')
  revalidatePath(`/${target.slug}`, 'layout')

  return NextResponse.json({ ok: true })
}
