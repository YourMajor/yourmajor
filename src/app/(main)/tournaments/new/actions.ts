'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { generateJoinCode } from '@/lib/join-code'
import { Resend } from 'resend'
import { TIER_LIMITS } from '@/lib/tiers'
import { getUserTier, consumeProCredit } from '@/lib/stripe'
import { sendSMS } from '@/lib/sms'

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

export async function createTournamentFromWizard(data: WizardPayload): Promise<{ slug: string } | { error: string }> {
  const user = await getUser()
  if (!user) redirect('/auth/login')

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
      return { error:
        userTier.tier === 'FREE'
          ? 'Free accounts are limited to 1 tournament per month. Upgrade to Pro, Club, or Tour for more.'
          : `Club accounts are limited to ${tierLimits.maxTournamentsPerMonth} tournaments per month. Upgrade to Tour for unlimited.`
      }
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

  const slug = await generateSlug(data.name)

  // Upload logo if provided
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

    // Invitations
    const inviteList = data.inviteList ?? data.inviteEmails.map((e) => ({ type: 'email' as const, value: e }))
    if (!data.isOpenRegistration && inviteList.length > 0) {
      await tx.invitation.createMany({
        data: inviteList.map((entry) => ({
          tournamentId: t.id,
          email: entry.type === 'email' ? entry.value : null,
          phone: entry.type === 'phone' ? entry.value : null,
        })),
      })
    }

    return t
  })
  } catch (err) {
    console.error('[createTournamentFromWizard] transaction failed:', err)
    return { error: friendlyPrismaError(err) }
  }

  // Consume a Pro credit if this tournament uses pro features and user is not on Tour or Club
  if (needsPro && userTier.tier !== 'LEAGUE' && userTier.tier !== 'CLUB') {
    const consumed = await consumeProCredit(user.id, tournament.id)
    if (!consumed) {
      // Tournament was created but no credit available — this shouldn't happen
      // due to earlier validation, but log it for safety
      console.warn(`[createTournamentFromWizard] No pro credit to consume for tournament ${tournament.id}`)
    }
  }

  // Initialize league features (roster, season config) for new leagues
  if (data.isLeague && !data.parentTournamentId) {
    try {
      const { getOrCreateRoster } = await import('@/lib/roster-actions')
      // Creates roster with the creator as the first member
      await getOrCreateRoster(tournament.id)
      // Set default season scoring method
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

    // Send emails for email-based invitations
    const emailInvitations = invitations.filter((inv) => inv.email)
    if (emailInvitations.length > 0) {
      await sendInviteEmails(tournament.name, slug, emailInvitations as Array<{ email: string; token: string }>).catch(() => {})
    }

    // Send SMS for phone-based invitations
    const domain = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    for (const inv of invitations) {
      if (inv.phone) {
        await sendSMS(
          inv.phone,
          `You're invited to ${tournament.name}! Join here: ${domain}/${slug}/register?token=${inv.token}`,
        ).catch(() => {})
      }
    }
  }

  return { slug }
}

export async function sendInviteEmails(
  tournamentName: string,
  slug: string,
  invitations: Array<{ email: string; token: string }>
) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const resend = new Resend(resendKey)
  const domain = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  await Promise.all(
    invitations.map(({ email, token }) =>
      resend.emails.send({
        from: process.env.EMAIL_FROM ?? 'noreply@yourdomain.com',
        to: email,
        subject: `You're invited to ${tournamentName}`,
        html: `
          <p>You have been invited to join <strong>${tournamentName}</strong>.</p>
          <p><a href="${domain}/${slug}/register?token=${token}" style="background:#006747;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;">Accept Invitation</a></p>
          <p>Or copy this link: ${domain}/${slug}/register?token=${token}</p>
        `,
      })
    )
  )
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

  await prisma.invitation.createMany({
    data: newEntries.map((entry) => ({
      tournamentId,
      email: entry.type === 'email' ? entry.value : null,
      phone: entry.type === 'phone' ? entry.value : null,
    })),
  })

  // Send email invites
  const newEmails = newEntries.filter((e) => e.type === 'email').map((e) => e.value)
  if (newEmails.length > 0) {
    const emailInvitations = await prisma.invitation.findMany({
      where: { tournamentId, email: { in: newEmails } },
      select: { email: true, token: true },
    })
    await sendInviteEmails(tournament.name, tournament.slug, emailInvitations as Array<{ email: string; token: string }>).catch(() => {})
  }

  // Send SMS invites
  const newPhones = newEntries.filter((e) => e.type === 'phone').map((e) => e.value)
  if (newPhones.length > 0) {
    const phoneInvitations = await prisma.invitation.findMany({
      where: { tournamentId, phone: { in: newPhones } },
      select: { phone: true, token: true },
    })
    const domain = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    for (const inv of phoneInvitations) {
      if (inv.phone) {
        await sendSMS(
          inv.phone,
          `You're invited to ${tournament.name}! Join here: ${domain}/${tournament.slug}/register?token=${inv.token}`,
        ).catch(() => {})
      }
    }
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
