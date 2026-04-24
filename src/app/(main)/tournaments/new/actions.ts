'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Prisma, type User } from '@/generated/prisma/client'
import { getUser } from '@/lib/auth'
import { generateJoinCode } from '@/lib/join-code'
import { TIER_LIMITS } from '@/lib/tiers'
import { getUserTier, consumeProCredit, getUnusedProCredits } from '@/lib/stripe'
import { sendInvitations, sendInviteEmails as sendInviteEmailsImpl } from '@/lib/invite-sender'
import { containsProfanity } from '@/lib/content-moderation'

function friendlyPrismaError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientValidationError) {
    // Extract the first "Unknown argument 'x'" or "Argument 'x' is missing"
    const unknown = err.message.match(/Unknown argument `(\w+)`/)
    if (unknown) return `Invalid field: "${unknown[1]}" is not recognised. The data model may be out of date — contact support.`
    const missing = err.message.match(/Argument `(\w+)` is missing/)
    if (missing) return `Required field "${missing[1]}" is missing.`
    return 'One or more fields are invalid. Please review your inputs.'
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(', ') : 'name'
      return `A tournament with this ${fields} already exists. Please choose a different name.`
    }
    if (err.code === 'P2003') {
      const field = err.meta?.field_name ?? 'reference'
      return `The selected ${field} no longer exists. Please go back and re-select.`
    }
    if (err.code === 'P2025') return 'Record not found. It may have been deleted.'
  }
  const msg = err instanceof Error ? err.message : String(err)
  return msg.length < 200 ? msg : 'Something went wrong. Please try again.'
}

export type RoundConfig = {
  roundNumber: number
  date: string
  courseId: string
  teeMode: 'UNIFORM' | 'CUSTOM'
  holeTees: Array<{ holeNumber: number; teeOptionId: string }>
}

export type WizardPayload = {
  name: string
  description: string
  startDate: string
  endDate: string
  numRounds: number
  logoBase64: string | null   // data URL from client FileReader
  logoMime: string | null
  logoExt: string | null
  headerBase64: string | null
  headerMime: string | null
  headerExt: string | null
  primaryColor: string
  accentColor: string
  rounds: RoundConfig[]
  handicapSystem: 'NONE' | 'WHS' | 'STABLEFORD' | 'CALLAWAY' | 'PEORIA'
  tournamentFormat?:
    | 'STROKE_PLAY' | 'STABLEFORD' | 'MODIFIED_STABLEFORD'
    | 'BEST_BALL' | 'BEST_BALL_2' | 'BEST_BALL_4'
    | 'SCRAMBLE' | 'SHAMBLE'
    | 'MATCH_PLAY' | 'RYDER_CUP'
    | 'SKINS' | 'SKINS_GROSS' | 'SKINS_NET'
    | 'QUOTA' | 'CHAPMAN' | 'PINEHURST' | 'LOW_GROSS_LOW_NET'
  formatConfig?: Record<string, unknown> | null
  powerupsEnabled: boolean
  powerupsPerPlayer: number
  maxAttacksPerPlayer: number
  distributionMode: 'DRAFT' | 'RANDOM'
  draftFormat: 'LINEAR' | 'SNAKE'
  draftTiming: 'PRE_TOURNAMENT' | 'PRE_ROUND'
  isOpenRegistration: boolean
  inviteEmails: string[]
  inviteList?: Array<{ type: 'email' | 'phone'; value: string }>
  tournamentType: 'PUBLIC' | 'OPEN' | 'INVITE'
  registrationDeadline?: string
  parentTournamentId?: string | null
  isLeague?: boolean
  leagueEndDate?: string
}

async function generateSlug(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const existing = await prisma.tournament.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  })
  if (!existing.some((t) => t.slug === base)) return base
  let i = 2
  while (existing.some((t) => t.slug === `${base}-${i}`)) i++
  return `${base}-${i}`
}

function isNextRedirectError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'digest' in err &&
    typeof (err as { digest: string }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
}

export async function createTournamentFromWizard(data: WizardPayload): Promise<{ slug: string } | { error: string }> {
  try {
    const user = await getUser()
    if (!user) redirect('/auth/login')

    return await _createTournament(data, user)
  } catch (err) {
    // Let Next.js redirect/notFound errors propagate — framework handles them
    if (isNextRedirectError(err)) throw err
    console.error('[createTournamentFromWizard] unexpected error:', err)
    return { error: friendlyPrismaError(err) }
  }
}

async function _createTournament(data: WizardPayload, user: User): Promise<{ slug: string } | { error: string }> {
  // Language filter for publicly discoverable tournaments
  if (data.tournamentType === 'PUBLIC') {
    if (containsProfanity(data.name)) {
      return { error: 'Tournament name contains inappropriate language. Please revise.' }
    }
    if (containsProfanity(data.description)) {
      return { error: 'Tournament description contains inappropriate language. Please revise.' }
    }
  }

  // Validate round dates
  if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
    return { error: 'Start date must be before end date.' }
  }
  for (const r of data.rounds) {
    if (r.date) {
      const roundDate = new Date(r.date)
      if (data.startDate && roundDate < new Date(new Date(data.startDate).setHours(0, 0, 0, 0))) {
        return { error: `Round ${r.roundNumber} date is before the tournament start date.` }
      }
      if (data.endDate && roundDate > new Date(new Date(data.endDate).setHours(23, 59, 59, 999))) {
        return { error: `Round ${r.roundNumber} date is after the tournament end date.` }
      }
    }
  }

  // Tier validation
  const userTier = await getUserTier(user.id)
  const tierLimits = TIER_LIMITS[userTier.tier]

  // Enforce per-month tournament limits for FREE and CLUB tiers
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
      return { error: `Club accounts are limited to ${tierLimits.maxTournamentsPerMonth} tournaments per month. Upgrade to Tour for unlimited.` }
    }
  }

  // Free tier: strip branding
  if (!tierLimits.customBranding) {
    data.primaryColor = '#006747'
    data.accentColor = '#C9A84C'
    data.logoBase64 = null
    data.logoMime = null
    data.logoExt = null
    data.headerBase64 = null
    data.headerMime = null
    data.headerExt = null
  }

  // Free tier: force gross-only scoring
  if (userTier.tier === 'FREE' && data.handicapSystem !== 'NONE') {
    data.handicapSystem = 'NONE'
  }

  // Free tier: block powerups
  if (!tierLimits.powerups && data.powerupsEnabled) {
    return { error: 'Powerups require a paid plan. Purchase a Pro credit ($29), subscribe to Club ($99/mo), or upgrade to Tour ($1,499/year).' }
  }

  // Free tier: cap rounds
  if (data.numRounds > tierLimits.maxRounds) {
    return { error: `Your plan supports up to ${tierLimits.maxRounds} round(s). Upgrade for multi-round tournaments.` }
  }

  const needsPro =
    data.numRounds > TIER_LIMITS.FREE.maxRounds ||
    data.powerupsEnabled

  // Verify credit availability before doing any work
  const requiresCredit = needsPro && userTier.tier !== 'LEAGUE' && userTier.tier !== 'CLUB'
  if (requiresCredit) {
    const credits = await getUnusedProCredits(user.id)
    if (credits === 0) {
      return { error: 'You have no Pro credits remaining. Purchase a credit to create this tournament.' }
    }
  }

  const slug = await generateSlug(data.name)

  // Upload logo if provided — lazy import to avoid module-level crash
  const { supabaseAdmin } = await import('@/lib/supabase')
  let logoUrl: string | null = null
  if (data.logoBase64 && data.logoMime && data.logoExt) {
    const base64Data = data.logoBase64.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `${slug}.${data.logoExt}`
    const { error } = await supabaseAdmin.storage
      .from('logos')
      .upload(path, buffer, { contentType: data.logoMime, upsert: true })
    if (!error) {
      const { data: urlData } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
      logoUrl = urlData.publicUrl
    }
  }

  // Upload header image if provided
  let headerImageUrl: string | null = null
  if (data.headerBase64 && data.headerMime && data.headerExt) {
    const base64Data = data.headerBase64.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `headers/${slug}.${data.headerExt}`
    const { error } = await supabaseAdmin.storage
      .from('logos')
      .upload(path, buffer, { contentType: data.headerMime, upsert: true })
    if (!error) {
      const { data: urlData } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
      headerImageUrl = urlData.publicUrl
    }
  }

  // Generate a shareable join code for non-invite tournaments
  const joinCode = data.tournamentType !== 'INVITE' ? await generateJoinCode() : null

  let tournament
  try {
  tournament = await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.create({
      data: {
        slug,
        joinCode,
        name: data.name,
        description: data.description || null,
        logo: logoUrl,
        headerImage: headerImageUrl,
        primaryColor: data.primaryColor,
        accentColor: data.accentColor,
        tournamentType: data.tournamentType,
        handicapSystem: data.handicapSystem,
        tournamentFormat: data.tournamentFormat ?? 'STROKE_PLAY',
        formatConfig: data.formatConfig
          ? (data.formatConfig as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        powerupsEnabled: data.powerupsEnabled,
        powerupsPerPlayer: data.powerupsPerPlayer,
        maxAttacksPerPlayer: data.maxAttacksPerPlayer,
        distributionMode: data.distributionMode,
        isOpenRegistration: data.isOpenRegistration,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
        status: 'REGISTRATION',
        isLeague: data.isLeague ?? false,
        leagueEndDate: data.leagueEndDate ? new Date(data.leagueEndDate) : null,
        parentTournamentId: data.parentTournamentId ?? null,
      },
    })

    // Creator as admin player — pull handicap from their profile
    const creatorProfile = await tx.playerProfile.findUnique({
      where: { userId: user.id },
      select: { handicap: true },
    })
    await tx.tournamentPlayer.create({
      data: { tournamentId: t.id, userId: user.id, isAdmin: true, isParticipant: false, handicap: creatorProfile?.handicap ?? 0 },
    })

    // Create rounds
    for (const r of data.rounds) {
      const round = await tx.tournamentRound.create({
        data: {
          tournamentId: t.id,
          roundNumber: r.roundNumber,
          date: r.date ? new Date(r.date) : null,
          courseId: r.courseId,
          teeMode: r.teeMode,
        },
      })

      // Custom per-hole tee assignments
      if (r.teeMode === 'CUSTOM' && r.holeTees.length > 0) {
        await tx.roundHoleTee.createMany({
          data: r.holeTees.map((ht) => ({
            roundId: round.id,
            holeNumber: ht.holeNumber,
            teeOptionId: ht.teeOptionId,
          })),
        })
      }
    }

    // Powerup system
    if (data.powerupsEnabled) {
      // Create draft record only when distribution mode is DRAFT
      if (data.distributionMode === 'DRAFT') {
        await tx.draft.create({
          data: {
            tournamentId: t.id,
            format: data.draftFormat,
            timing: data.draftTiming,
          },
        })
      }

      // Link all powerups to this tournament
      const allPowerups = await tx.powerup.findMany({ select: { id: true } })
      if (allPowerups.length > 0) {
        await tx.tournamentPowerup.createMany({
          data: allPowerups.map((p) => ({
            tournamentId: t.id,
            powerupId: p.id,
            quantity: 1,
          })),
        })
      }
    }

    // Invitations — expire in 14 days so leaked links do not remain valid forever
    const inviteList = data.inviteList ?? data.inviteEmails.map((e) => ({ type: 'email' as const, value: e }))
    if (!data.isOpenRegistration && inviteList.length > 0) {
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      await tx.invitation.createMany({
        data: inviteList.map((entry) => ({
          tournamentId: t.id,
          email: entry.type === 'email' ? entry.value : null,
          phone: entry.type === 'phone' ? entry.value : null,
          expiresAt,
        })),
      })
    }

    // Consume Pro credit inside the transaction so it's atomic with
    // tournament creation — if this fails, everything rolls back.
    if (requiresCredit) {
      const consumed = await consumeProCredit(user.id, t.id, tx)
      if (!consumed) {
        throw new Error('No Pro credits available. Purchase a credit to create this tournament.')
      }
    }

    return t
  })
  } catch (err) {
    console.error('[createTournamentFromWizard] transaction failed:', err)
    return { error: friendlyPrismaError(err) }
  }

  // Post-create operations are best-effort — the tournament is already persisted.
  // Wrap in try-catch so failures here never prevent the user from reaching their tournament.
  try {
    // Initialize league features (roster, season config) for new leagues
    if (data.isLeague && !data.parentTournamentId) {
      try {
        const { getOrCreateRoster } = await import('@/lib/roster-actions')
        await getOrCreateRoster(tournament.id)
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: { seasonScoringMethod: 'POINTS' },
        })
      } catch {
        console.warn('[createTournamentFromWizard] League initialization failed')
      }
    }

    // Auto-invite roster members for renewed league tournaments
    if (data.parentTournamentId) {
      try {
        const { getOrCreateRoster } = await import('@/lib/roster-actions')
        const roster = await getOrCreateRoster(data.parentTournamentId)
        if (roster) {
          const activeMembers = roster.members.filter((m) => m.status === 'ACTIVE' && m.userId !== user.id)
          for (const member of activeMembers) {
            const existing = await prisma.tournamentPlayer.findUnique({
              where: { tournamentId_userId: { tournamentId: tournament.id, userId: member.userId } },
            })
            if (!existing) {
              const profile = await prisma.playerProfile.findUnique({
                where: { userId: member.userId },
                select: { handicap: true },
              })
              await prisma.tournamentPlayer.create({
                data: {
                  tournamentId: tournament.id,
                  userId: member.userId,
                  handicap: profile?.handicap ?? 0,
                },
              }).catch(() => {})
            }
          }
        }
      } catch {
        console.warn('[createTournamentFromWizard] Roster auto-invite failed')
      }
    }

    // Send invite emails + SMS outside transaction
    const allInvites = data.inviteList ?? data.inviteEmails.map((e) => ({ type: 'email' as const, value: e }))
    if (!data.isOpenRegistration && allInvites.length > 0) {
      const invitations = await prisma.invitation.findMany({
        where: { tournamentId: tournament.id },
        select: { email: true, token: true, phone: true },
      })
      await sendInvitations({
        tournamentName: tournament.name,
        slug,
        invitations,
      }).catch(() => {})
    }
  } catch (err) {
    console.error('[createTournamentFromWizard] post-create error (tournament was created):', err)
  }

  return { slug }
}

// Re-export the email-only path so existing imports of `sendInviteEmails` from
// '@/app/(main)/tournaments/new/actions' continue to work. Implementation lives
// in '@/lib/invite-sender' and now also handles SMS.
export async function sendInviteEmails(
  tournamentName: string,
  slug: string,
  invitations: Array<{ email: string; token: string }>,
): Promise<void> {
  await sendInviteEmailsImpl(tournamentName, slug, invitations)
}

export async function sendLateInvites(
  tournamentId: string,
  entries: Array<{ type: 'email' | 'phone'; value: string }>,
) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, slug: true },
  })
  if (!tournament) return

  // Verify caller is a tournament admin
  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { isAdmin: true },
  })
  if (!membership?.isAdmin && user.role !== 'ADMIN') return

  const emailEntries = entries.filter((e) => e.type === 'email')
  const phoneEntries = entries.filter((e) => e.type === 'phone')

  // Skip already-invited emails/phones
  const existingByEmail = emailEntries.length > 0
    ? await prisma.invitation.findMany({
        where: { tournamentId, email: { in: emailEntries.map((e) => e.value) } },
        select: { email: true },
      })
    : []
  const existingByPhone = phoneEntries.length > 0
    ? await prisma.invitation.findMany({
        where: { tournamentId, phone: { in: phoneEntries.map((e) => e.value) } },
        select: { phone: true },
      })
    : []

  const existingEmails = new Set(existingByEmail.map((i) => i.email))
  const existingPhones = new Set(existingByPhone.map((i) => i.phone))

  const newEntries = entries.filter((e) =>
    e.type === 'email' ? !existingEmails.has(e.value) : !existingPhones.has(e.value)
  )

  if (newEntries.length === 0) return

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  await prisma.invitation.createMany({
    data: newEntries.map((entry) => ({
      tournamentId,
      email: entry.type === 'email' ? entry.value : null,
      phone: entry.type === 'phone' ? entry.value : null,
      expiresAt,
    })),
  })

  // Fan out email + SMS via shared helper
  const newEmails = newEntries.filter((e) => e.type === 'email').map((e) => e.value)
  const newPhones = newEntries.filter((e) => e.type === 'phone').map((e) => e.value)
  const orFilters = []
  if (newEmails.length > 0) orFilters.push({ email: { in: newEmails } })
  if (newPhones.length > 0) orFilters.push({ phone: { in: newPhones } })
  if (orFilters.length > 0) {
    const newInvitations = await prisma.invitation.findMany({
      where: { tournamentId, OR: orFilters },
      select: { email: true, phone: true, token: true },
    })
    await sendInvitations({
      tournamentName: tournament.name,
      slug: tournament.slug,
      invitations: newInvitations,
    }).catch(() => {})
  }
}

export async function setTournamentStatus(tournamentId: string, newStatus: string) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { isAdmin: true },
  })
  if (!membership?.isAdmin && user.role !== 'ADMIN') {
    throw new Error('Forbidden')
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: newStatus as 'REGISTRATION' | 'ACTIVE' | 'COMPLETED' },
  })

  // Cache the champion when completing a tournament
  if (newStatus === 'COMPLETED') {
    try {
      const { getLeaderboard } = await import('@/lib/scoring')
      const standings = await getLeaderboard(tournamentId)
      const champion = standings.find((s) => s.rank === 1)
      if (champion) {
        const tp = await prisma.tournamentPlayer.findUnique({
          where: { id: champion.tournamentPlayerId },
          select: { userId: true },
        })
        await prisma.tournament.update({
          where: { id: tournamentId },
          data: {
            championUserId: tp?.userId ?? null,
            championName: champion.playerName,
          },
        })
      }
    } catch {
      // Non-critical: champion caching failure shouldn't block status change
    }
  }

  revalidatePath('/', 'layout')
}
