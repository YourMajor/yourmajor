import { NextRequest, NextResponse } from 'next/server'
import { parseBody, HEX_COLOR, ISO_DATE } from '@/lib/parse-body'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser, isTournamentAdmin } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // Explicit select, not the whole row: every column published here is a
  // deliberate choice. joinCode stays out (it's the invite secret), and
  // rounds.peoriaHoles stays out — those are the six secret Peoria holes the
  // leaderboard only reveals once a round is complete (lib/formats/strokePlay.ts),
  // so handing them to any caller mid-round breaks the format's scoring.
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      logo: true,
      headerImage: true,
      primaryColor: true,
      accentColor: true,
      status: true,
      tournamentType: true,
      isOpenRegistration: true,
      registrationClosed: true,
      handicapSystem: true,
      tournamentFormat: true,
      formatConfig: true,
      teamsEnabled: true,
      teamSize: true,
      powerupsEnabled: true,
      powerupsPerPlayer: true,
      maxAttacksPerPlayer: true,
      distributionMode: true,
      startDate: true,
      endDate: true,
      registrationDeadline: true,
      createdAt: true,
      sponsorName: true,
      sponsorLogoUrl: true,
      sponsorBannerUrl: true,
      sponsorLink: true,
      subdomain: true,
      parentTournamentId: true,
      championUserId: true,
      championName: true,
      isLeague: true,
      leagueEndDate: true,
      seasonScoringMethod: true,
      seasonBestOf: true,
      seasonPointsTable: true,
      seasonDropLowest: true,
      seasonTiebreakers: true,
      seasonAttendanceBonus: true,
      rounds: {
        select: {
          id: true,
          tournamentId: true,
          roundNumber: true,
          date: true,
          courseId: true,
          teeMode: true,
          roundStartAnnouncedAt: true,
          course: {
            select: {
              id: true,
              externalId: true,
              name: true,
              location: true,
              latitude: true,
              longitude: true,
              par: true,
              isCustom: true,
            },
          },
        },
      },
      _count: { select: { players: true } },
    },
  })
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Same visibility gate the leaderboard route applies: anonymous spectating is
  // a real feature, so gate on visibility rather than requiring auth outright.
  // INVITE is the codebase's notion of private (see tournaments/find, which
  // excludes exactly that type from join-code lookup).
  if (tournament.tournamentType === 'INVITE') {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
      select: { id: true },
    })
    if (!membership && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.json(tournament)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isTournamentAdmin(user.id, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // status was previously written straight through with no enum check, so any
  // string could land in the column; logo was an unvalidated free-text URL.
  const parsed = await parseBody(request, z.object({
    name: z.string().trim().min(1).max(200).optional(),
    slug: z.string().trim().min(1).max(200).optional(),
    primaryColor: HEX_COLOR.optional(),
    accentColor: HEX_COLOR.optional(),
    isOpenRegistration: z.boolean().optional(),
    startDate: ISO_DATE.nullish(),
    endDate: ISO_DATE.nullish(),
    status: z.enum(['REGISTRATION', 'ACTIVE', 'COMPLETED']).optional(),
    logo: z.string().url().max(2000).nullish(),
  }))
  if (!parsed.ok) return parsed.response
  const { name, slug, primaryColor, accentColor, isOpenRegistration, startDate, endDate, status, logo } = parsed.data

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

  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isTournamentAdmin(user.id, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
