'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { generateJoinCode } from '@/lib/join-code'
import { getUserTier, consumeProCredit } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import { getLeagueRootId } from '@/lib/league-events'

/**
 * Find the latest (most recent) tournament in a chain.
 */
async function getLatestInChain(tournamentId: string) {
  let currentId = tournamentId
  for (let i = 0; i < 100; i++) {
    const child = await prisma.tournament.findFirst({
      where: { parentTournamentId: currentId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (!child) break
    currentId = child.id
  }
  return currentId
}

/**
 * Creates a new event in the league chain, cloning settings from the latest event.
 * Automatically registers all active roster members.
 */
export async function scheduleLeagueEvent(
  tournamentId: string,
  data: { date: string; notes?: string; courseId?: string; teeMode?: 'UNIFORM' | 'CUSTOM' }
) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  // Verify admin
  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { isAdmin: true },
  })
  if (!membership?.isAdmin && user.role !== 'ADMIN') {
    throw new Error('Only admins can schedule league events.')
  }

  // Tier validation — each league event costs a tournament credit
  const userTier = await getUserTier(user.id)
  const tierLimits = TIER_LIMITS[userTier.tier]
  if (tierLimits.maxTournamentsPerMonth !== Infinity) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const tournamentsThisMonth = await prisma.tournament.count({
      where: {
        players: { some: { userId: user.id, isAdmin: true } },
        createdAt: { gte: monthStart },
      },
    })
    if (tournamentsThisMonth >= tierLimits.maxTournamentsPerMonth) {
      throw new Error(`Club accounts are limited to ${tierLimits.maxTournamentsPerMonth} tournaments per month. Upgrade to Tour for unlimited.`)
    }
  }

  // Get the latest tournament in the chain to use as template
  const latestId = await getLatestInChain(tournamentId)
  const template = await prisma.tournament.findUnique({
    where: { id: latestId },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: { course: { select: { id: true } } },
      },
    },
  })
  if (!template) throw new Error('Tournament not found.')

  // Generate slug — base off the league root, not the previous event, so
  // month-day suffixes don't accumulate (test-apr-25 → test-apr-may-2 → ...).
  const eventDate = new Date(data.date)
  const monthDay = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase().replace(/\s+/g, '-')
  const rootId = await getLeagueRootId(tournamentId)
  const rootSlug = rootId
    ? (await prisma.tournament.findUnique({ where: { id: rootId }, select: { slug: true } }))?.slug
    : null
  const baseSlug = (rootSlug ?? template.slug).replace(/-wk\d+$/, '')
  let slug = `${baseSlug}-${monthDay}`
  const existing = await prisma.tournament.findUnique({ where: { slug } })
  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`
  }

  const joinCode = template.isOpenRegistration ? await generateJoinCode() : null

  // Create the new event
  const newEvent = await prisma.tournament.create({
    data: {
      slug,
      joinCode,
      name: template.name,
      description: template.description,
      logo: template.logo,
      headerImage: template.headerImage,
      primaryColor: template.primaryColor,
      accentColor: template.accentColor,
      status: 'REGISTRATION',
      tournamentType: template.tournamentType,
      isOpenRegistration: template.isOpenRegistration,
      handicapSystem: template.handicapSystem,
      powerupsEnabled: template.powerupsEnabled,
      powerupsPerPlayer: template.powerupsPerPlayer,
      maxAttacksPerPlayer: template.maxAttacksPerPlayer,
      distributionMode: template.distributionMode,
      startDate: eventDate,
      endDate: eventDate,
      parentTournamentId: latestId,
      isLeague: true,
    },
  })

  // Clone rounds — use override course if provided, otherwise same as template
  for (const round of template.rounds) {
    await prisma.tournamentRound.create({
      data: {
        tournamentId: newEvent.id,
        roundNumber: round.roundNumber,
        date: eventDate,
        courseId: data.courseId ?? round.courseId,
        teeMode: data.teeMode ?? round.teeMode,
      },
    })
  }

  // Register the admin
  const adminProfile = await prisma.playerProfile.findUnique({
    where: { userId: user.id },
    select: { handicap: true },
  })
  await prisma.tournamentPlayer.create({
    data: {
      tournamentId: newEvent.id,
      userId: user.id,
      isAdmin: true,
      handicap: adminProfile?.handicap ?? 0,
    },
  })

  // Auto-register all active roster members. Resolves handicaps in one
  // batched query and inserts the new tournamentPlayer rows via a single
  // createMany — was N+N round-trips for an N-member roster.
  try {
    const { getOrCreateRoster } = await import('@/lib/roster-actions')
    const roster = await getOrCreateRoster(tournamentId)
    if (roster) {
      const activeMembers = roster.members.filter((m) => m.status === 'ACTIVE' && m.userId !== user.id)
      if (activeMembers.length > 0) {
        const memberUserIds = activeMembers.map((m) => m.userId)
        const profiles = await prisma.playerProfile.findMany({
          where: { userId: { in: memberUserIds } },
          select: { userId: true, handicap: true },
        })
        const handicapByUserId = new Map(profiles.map((p) => [p.userId, p.handicap]))
        await prisma.tournamentPlayer.createMany({
          data: activeMembers.map((m) => ({
            tournamentId: newEvent.id,
            userId: m.userId,
            handicap: handicapByUserId.get(m.userId) ?? 0,
          })),
          skipDuplicates: true,
        }).catch(() => {})
      }
    }
  } catch {
    // Non-critical
  }

  // Create powerup system if enabled
  if (template.powerupsEnabled && template.distributionMode === 'DRAFT') {
    await prisma.draft.create({
      data: { tournamentId: newEvent.id, format: 'SNAKE', timing: 'PRE_TOURNAMENT' },
    }).catch(() => {})

    const allPowerups = await prisma.powerup.findMany({ select: { id: true } })
    if (allPowerups.length > 0) {
      await prisma.tournamentPowerup.createMany({
        data: allPowerups.map((p) => ({
          tournamentId: newEvent.id,
          powerupId: p.id,
          quantity: 1,
        })),
      }).catch(() => {})
    }
  }

  // Consume a Pro credit for this league event (same as any tournament)
  const needsPro =
    template.rounds.length > TIER_LIMITS.FREE.maxRounds ||
    template.powerupsEnabled
  if (needsPro && userTier.tier !== 'LEAGUE' && userTier.tier !== 'CLUB') {
    await consumeProCredit(user.id, newEvent.id).catch(() => {
      console.warn(`[scheduleLeagueEvent] No pro credit to consume for event ${newEvent.id}`)
    })
  }

  if (rootSlug) revalidatePath(`/${rootSlug}`, 'layout')
  revalidatePath(`/${newEvent.slug}`, 'layout')
  return { slug: newEvent.slug }
}

/**
 * Delete a league chain event. Admin-only.
 *
 * Guards:
 *  - Refuses to delete the root tournament (the league itself). Use the
 *    tournament Danger Zone for that.
 *  - Refuses to delete events that already have submitted scores — admins
 *    must clear those first to avoid silent data loss.
 *
 * Behaviour:
 *  - Re-links any direct children (parentTournamentId === eventId) to point
 *    at the deleted event's parent, so the chain stays intact:
 *      root → A → B → C   (delete B)   →   root → A → C
 *  - Cascade-deletes the event row's TournamentPlayer / TournamentGroup /
 *    Round records via Prisma's onDelete relationships already in the schema.
 */
export async function deleteLeagueEvent(
  eventId: string,
): Promise<{ ok: true; redirectSlug: string } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const event = await prisma.tournament.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      slug: true,
      name: true,
      parentTournamentId: true,
      isLeague: true,
    },
  })
  if (!event) return { ok: false, error: 'Event not found.' }

  // Admin check — must be admin of THIS event (or super-admin).
  if (user.role !== 'ADMIN') {
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: eventId, userId: user.id } },
      select: { isAdmin: true },
    })
    if (!membership?.isAdmin) {
      return { ok: false, error: 'Only league admins can delete events.' }
    }
  }

  // Block root deletion — that's the whole league.
  if (event.isLeague && !event.parentTournamentId) {
    return {
      ok: false,
      error: 'Cannot delete the league root. Use the tournament Danger Zone instead.',
    }
  }

  // Block when scores exist.
  const scoreCount = await prisma.score.count({
    where: { round: { tournamentId: eventId } },
  })
  if (scoreCount > 0) {
    return {
      ok: false,
      error: `Cannot delete — ${scoreCount} score${scoreCount === 1 ? '' : 's'} already submitted. Clear scores first.`,
    }
  }

  // Find the parent we'll re-anchor children to.
  const newParentId = event.parentTournamentId

  // Find a slug to redirect to after delete: prefer parent, else first remaining
  // sibling at the root, else the root itself.
  let redirectSlug: string | null = null
  if (newParentId) {
    const parent = await prisma.tournament.findUnique({
      where: { id: newParentId },
      select: { slug: true },
    })
    redirectSlug = parent?.slug ?? null
  }

  await prisma.$transaction(async (tx) => {
    // Re-link direct children to point at the deleted event's parent.
    await tx.tournament.updateMany({
      where: { parentTournamentId: eventId },
      data: { parentTournamentId: newParentId },
    })
    // Delete the event itself. Cascade onDelete handles rounds, players,
    // groups, scores (via round cascade), invitations, etc.
    await tx.tournament.delete({ where: { id: eventId } })
  })

  revalidatePath(`/${event.slug}`, 'layout')
  if (redirectSlug && redirectSlug !== event.slug) {
    revalidatePath(`/${redirectSlug}`, 'layout')
  }
  return { ok: true, redirectSlug: redirectSlug ?? '' }
}
