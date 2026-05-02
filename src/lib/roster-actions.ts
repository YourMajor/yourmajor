'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { sendInvitations } from '@/lib/invite-sender'

async function getRootTournamentId(tournamentId: string): Promise<string> {
  let currentId = tournamentId
  for (let i = 0; i < 100; i++) {
    const t = await prisma.tournament.findUnique({
      where: { id: currentId },
      select: { id: true, parentTournamentId: true },
    })
    if (!t || !t.parentTournamentId) return currentId
    currentId = t.parentTournamentId
  }
  return currentId
}

async function revalidateRosterScope(tournamentId: string, rootId: string) {
  // Revalidate the entered slug (where the action originated) plus the league
  // root's slug so the season dashboard reflects the change. Avoids the
  // site-wide bust of `revalidatePath('/', 'layout')`.
  const [self, root] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } }),
    rootId === tournamentId
      ? Promise.resolve(null)
      : prisma.tournament.findUnique({ where: { id: rootId }, select: { slug: true } }),
  ])
  if (self?.slug) revalidatePath(`/${self.slug}`, 'layout')
  if (root?.slug && root.slug !== self?.slug) revalidatePath(`/${root.slug}`, 'layout')
}

async function requireAdmin(tournamentId: string) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  if (user.role !== 'ADMIN') {
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: user.id } },
      select: { isAdmin: true },
    })
    if (!membership?.isAdmin) throw new Error('Forbidden')
  }
  return user
}

export async function getOrCreateRoster(tournamentId: string) {
  const rootId = await getRootTournamentId(tournamentId)

  let roster = await prisma.leagueRoster.findUnique({
    where: { rootTournamentId: rootId },
    include: {
      members: {
        include: {
          user: {
            include: { profile: { select: { avatar: true, displayName: true, handicap: true } } },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  if (!roster) {
    // Auto-create roster from all players who have participated in any tournament in the chain
    roster = await prisma.leagueRoster.create({
      data: {
        rootTournamentId: rootId,
        autoAddNew: true,
      },
      include: {
        members: {
          include: {
            user: {
              include: { profile: { select: { avatar: true, displayName: true, handicap: true } } },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    })

    // Seed roster with all unique players from the chain
    const allTournamentIds = await getAllChainIds(rootId)
    const players = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: { in: allTournamentIds } },
      select: { userId: true },
      distinct: ['userId'],
    })

    if (players.length > 0) {
      await prisma.leagueRosterMember.createMany({
        data: players.map((p) => ({
          rosterId: roster!.id,
          userId: p.userId,
        })),
        skipDuplicates: true,
      })

      // Re-fetch with members
      roster = await prisma.leagueRoster.findUnique({
        where: { id: roster.id },
        include: {
          members: {
            include: {
              user: {
                include: { profile: { select: { avatar: true, displayName: true, handicap: true } } },
              },
            },
            orderBy: { joinedAt: 'asc' },
          },
        },
      })
    }
  }

  return roster
}

async function getAllChainIds(rootId: string): Promise<string[]> {
  const ids = [rootId]
  let currentSearch = [rootId]
  for (let i = 0; i < 100; i++) {
    const children = await prisma.tournament.findMany({
      where: { parentTournamentId: { in: currentSearch } },
      select: { id: true },
    })
    if (children.length === 0) break
    const childIds = children.map((c) => c.id)
    ids.push(...childIds)
    currentSearch = childIds
  }
  return ids
}

export async function addRosterMember(tournamentId: string, email: string) {
  await requireAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) throw new Error(`No user found with email ${email}`)

  const roster = await prisma.leagueRoster.findUnique({ where: { rootTournamentId: rootId } })
  if (!roster) throw new Error('Roster not found')

  await prisma.leagueRosterMember.upsert({
    where: { rosterId_userId: { rosterId: roster.id, userId: user.id } },
    create: { rosterId: roster.id, userId: user.id },
    update: { status: 'ACTIVE' },
  })

  await revalidateRosterScope(tournamentId, rootId)
}

export async function updateRosterMemberStatus(
  tournamentId: string,
  memberId: string,
  status: 'ACTIVE' | 'INACTIVE'
) {
  await requireAdmin(tournamentId)

  await prisma.leagueRosterMember.update({
    where: { id: memberId },
    data: { status },
  })

  await revalidateRosterScope(tournamentId, await getRootTournamentId(tournamentId))
}

export async function removeRosterMember(tournamentId: string, memberId: string) {
  await requireAdmin(tournamentId)

  await prisma.leagueRosterMember.delete({ where: { id: memberId } })

  await revalidateRosterScope(tournamentId, await getRootTournamentId(tournamentId))
}

export async function toggleAutoAddNew(tournamentId: string, autoAddNew: boolean) {
  await requireAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)

  await prisma.leagueRoster.update({
    where: { rootTournamentId: rootId },
    data: { autoAddNew },
  })

  await revalidateRosterScope(tournamentId, rootId)
}

export async function updateSeasonConfig(
  tournamentId: string,
  config: {
    seasonScoringMethod: string
    seasonBestOf: number | null
    seasonPointsTable: Record<number, number> | null
    leagueEndDate?: string | null
    seasonDropLowest?: number | null
    seasonTiebreakers?: string[] | null
  },
) {
  await requireAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)

  await prisma.tournament.update({
    where: { id: rootId },
    data: {
      seasonScoringMethod: config.seasonScoringMethod as 'POINTS' | 'STROKE_AVG' | 'BEST_OF_N' | 'STABLEFORD_CUMULATIVE',
      seasonBestOf: config.seasonBestOf,
      seasonPointsTable: config.seasonPointsTable ?? undefined,
      ...(config.leagueEndDate !== undefined && {
        leagueEndDate: config.leagueEndDate ? new Date(config.leagueEndDate) : null,
      }),
      ...(config.seasonDropLowest !== undefined && {
        seasonDropLowest: config.seasonDropLowest,
      }),
      ...(config.seasonTiebreakers !== undefined && {
        seasonTiebreakers: (config.seasonTiebreakers ?? undefined) as Prisma.InputJsonValue | undefined,
      }),
    },
  })

  await revalidateRosterScope(tournamentId, rootId)
}

// ─── CSV roster import ───────────────────────────────────────────────────────

export interface CsvRosterRow {
  name?: string
  email?: string
  phone?: string
  handicap?: number
}

export interface CsvImportResult {
  added: number
  reactivated: number
  skipped: number
  invalid: number
  invitedEmails: number
  invitedPhones: number
  duplicateEmails: string[]
  duplicatePhones: string[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9\s\-()]{7,}$/

/**
 * Bulk-import roster members from a parsed CSV. Run inside a single transaction:
 * upsert User → upsert PlayerProfile.handicap → create LeagueRosterMember →
 * create Invitation rows. Invite emails + SMS are sent post-commit via the
 * shared invite-sender helper.
 *
 * Dedupes against existing User.email / Invitation.phone and existing roster
 * members before writing.
 */
export async function importRosterCsv(
  tournamentId: string,
  rows: CsvRosterRow[],
): Promise<CsvImportResult> {
  await requireAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)

  const result: CsvImportResult = {
    added: 0,
    reactivated: 0,
    skipped: 0,
    invalid: 0,
    invitedEmails: 0,
    invitedPhones: 0,
    duplicateEmails: [],
    duplicatePhones: [],
  }

  // Validate + normalise.
  const valid: Required<Pick<CsvRosterRow, 'name'>> & CsvRosterRow & { email: string | null; phone: string | null }[] = [] as never
  const cleanRows: Array<{ name: string; email: string | null; phone: string | null; handicap: number | null }> = []
  for (const raw of rows) {
    const email = (raw.email ?? '').trim().toLowerCase() || null
    const phone = (raw.phone ?? '').trim() || null
    const name = (raw.name ?? '').trim() || (email ? email.split('@')[0] : null)
    if (!name || (!email && !phone)) {
      result.invalid += 1
      continue
    }
    if (email && !EMAIL_RE.test(email)) {
      result.invalid += 1
      continue
    }
    if (phone && !PHONE_RE.test(phone)) {
      result.invalid += 1
      continue
    }
    const handicap = typeof raw.handicap === 'number' && Number.isFinite(raw.handicap)
      ? Math.max(0, Math.min(54, raw.handicap))
      : null
    cleanRows.push({ name, email, phone, handicap })
  }
  // Suppress unused-variable warning while keeping the typed scaffold above readable.
  void valid

  if (cleanRows.length === 0) return result

  const roster = await prisma.leagueRoster.findUnique({
    where: { rootTournamentId: rootId },
    include: { members: { select: { userId: true, status: true } } },
  })
  if (!roster) {
    throw new Error('League roster not found. Create at least one league event before importing.')
  }

  const memberStatusByUserId = new Map(roster.members.map((m) => [m.userId, m.status]))

  // Resolve existing users by email so we can preserve the foreign key.
  const emailRows = cleanRows.filter((r): r is typeof r & { email: string } => Boolean(r.email))
  const phoneRows = cleanRows.filter((r): r is typeof r & { phone: string } => Boolean(r.phone))

  const existingUsers = emailRows.length > 0
    ? await prisma.user.findMany({
        where: { email: { in: emailRows.map((r) => r.email) } },
        select: { id: true, email: true },
      })
    : []
  const userIdByEmail = new Map(existingUsers.map((u) => [u.email, u.id]))

  // Collect existing tournament invitations so we don't double-invite.
  const existingInvites = await prisma.invitation.findMany({
    where: { tournamentId: rootId },
    select: { email: true, phone: true },
  })
  const invitedEmails = new Set(existingInvites.map((i) => i.email).filter((e): e is string => !!e))
  const invitedPhones = new Set(existingInvites.map((i) => i.phone).filter((p): p is string => !!p))

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  await prisma.$transaction(async (tx) => {
    // 1. Upsert users by email (no auth credentials — they verify via magic link).
    for (const row of cleanRows) {
      let userId: string | undefined = row.email ? userIdByEmail.get(row.email) : undefined
      if (!userId && row.email) {
        const created = await tx.user.create({
          data: { email: row.email, name: row.name },
          select: { id: true },
        })
        userId = created.id
        userIdByEmail.set(row.email, userId)
      }
      // Phone-only rows can't create a User without an email — skip the
      // PlayerProfile + LeagueRosterMember portion and just record the invite.
      if (!userId) continue

      // 2. PlayerProfile upsert with handicap if provided.
      if (row.handicap !== null) {
        await tx.playerProfile.upsert({
          where: { userId },
          create: { userId, displayName: row.name, handicap: row.handicap },
          update: { handicap: row.handicap },
        })
      } else {
        await tx.playerProfile.upsert({
          where: { userId },
          create: { userId, displayName: row.name },
          update: {},
        })
      }

      // 3. LeagueRosterMember.
      const existingStatus = memberStatusByUserId.get(userId)
      if (existingStatus === undefined) {
        await tx.leagueRosterMember.create({ data: { rosterId: roster.id, userId } })
        result.added += 1
      } else if (existingStatus === 'INACTIVE') {
        await tx.leagueRosterMember.updateMany({
          where: { rosterId: roster.id, userId },
          data: { status: 'ACTIVE' },
        })
        result.reactivated += 1
      } else {
        result.skipped += 1
        if (row.email) result.duplicateEmails.push(row.email)
      }
    }

    // 4. Create new Invitations (email and/or phone) at the root tournament.
    const newEmailInvites = emailRows.filter((r) => !invitedEmails.has(r.email))
    const newPhoneInvites = phoneRows.filter((r) => !invitedPhones.has(r.phone))
    if (newEmailInvites.length > 0) {
      await tx.invitation.createMany({
        data: newEmailInvites.map((r) => ({
          tournamentId: rootId,
          email: r.email,
          expiresAt,
        })),
      })
    }
    if (newPhoneInvites.length > 0) {
      await tx.invitation.createMany({
        data: newPhoneInvites.map((r) => ({
          tournamentId: rootId,
          phone: r.phone,
          expiresAt,
        })),
      })
    }
    result.invitedEmails = newEmailInvites.length
    result.invitedPhones = newPhoneInvites.length
    for (const r of emailRows.filter((r) => invitedEmails.has(r.email))) {
      if (!result.duplicateEmails.includes(r.email)) result.duplicateEmails.push(r.email)
    }
    for (const r of phoneRows.filter((r) => invitedPhones.has(r.phone))) {
      result.duplicatePhones.push(r.phone)
    }
  })

  // Send notifications post-commit via the shared helper.
  if (result.invitedEmails > 0 || result.invitedPhones > 0) {
    const root = await prisma.tournament.findUnique({
      where: { id: rootId },
      select: { name: true, slug: true },
    })
    const newInvitations = await prisma.invitation.findMany({
      where: {
        tournamentId: rootId,
        OR: [
          { email: { in: cleanRows.map((r) => r.email).filter((e): e is string => !!e) } },
          { phone: { in: cleanRows.map((r) => r.phone).filter((p): p is string => !!p) } },
        ],
      },
      select: { email: true, phone: true, token: true },
    })
    if (root) {
      await sendInvitations({
        tournamentName: root.name,
        slug: root.slug,
        invitations: newInvitations,
      }).catch(() => {})
    }
  }

  await revalidateRosterScope(tournamentId, rootId)
  return result
}
