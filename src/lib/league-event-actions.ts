'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { generateJoinCode } from '@/lib/join-code'
import { getUserTier, consumeProCredit } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'

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
      throw new Error(
        userTier.tier === 'FREE'
          ? 'Free accounts are limited to 1 tournament per month. Purchase a Pro credit ($29) or upgrade to Club ($99/mo) for more.'
          : `Club accounts are limited to ${tierLimits.maxTournamentsPerMonth} tournaments per month. Upgrade to Tour for unlimited.`
      )
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

  // Generate slug
  const eventDate = new Date(data.date)
  const monthDay = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase().replace(/\s+/g, '-')
  const baseSlug = template.slug.replace(/-wk\d+$/, '').replace(/-\d+$/, '')
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

  // Auto-register all active roster members
  try {
    const { getOrCreateRoster } = await import('@/lib/roster-actions')
    const roster = await getOrCreateRoster(tournamentId)
    if (roster) {
      const activeMembers = roster.members.filter((m) => m.status === 'ACTIVE' && m.userId !== user.id)
      for (const member of activeMembers) {
        const profile = await prisma.playerProfile.findUnique({
          where: { userId: member.userId },
          select: { handicap: true },
        })
        await prisma.tournamentPlayer.create({
          data: {
            tournamentId: newEvent.id,
            userId: member.userId,
            handicap: profile?.handicap ?? 0,
          },
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

  revalidatePath('/', 'layout')
  return { slug: newEvent.slug }
}
