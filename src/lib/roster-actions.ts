'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { requireTournamentAdmin } from '@/lib/auth'
import { sendInvitations } from '@/lib/invite-sender'
import { getRootTournamentId } from '@/lib/league-chain'

/**
 * Resolve the league root for `tournamentId` and prove the caller administers
 * that root — not just the tournament id they handed us.
 *
 * Every write in this module is keyed on the resolved root, but
 * `requireTournamentAdmin` matches the exact id it is given and never walks the
 * chain. Authorizing only the caller-supplied leaf therefore let an admin of
 * any descendant event steer these actions at another organizer's league root.
 * The leaf check is kept as well, so this can only ever refuse access, never
 * grant it.
 */
async function requireLeagueRootAdmin(tournamentId: string): Promise<string> {
  await requireTournamentAdmin(tournamentId)
  const rootId = await getRootTournamentId(tournamentId)
  if (rootId !== tournamentId) await requireTournamentAdmin(rootId)
  return rootId
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


export async function getOrCreateRoster(tournamentId: string) {
  const rootId = await requireLeagueRootAdmin(tournamentId)

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

export async function updateRosterMemberStatus(
  tournamentId: string,
  memberId: string,
  status: 'ACTIVE' | 'INACTIVE'
) {
  const rootId = await requireLeagueRootAdmin(tournamentId)

  // Scope the write to this league's roster — being an admin of one league
  // must not let a caller pass a memberId belonging to another league.
  const { count } = await prisma.leagueRosterMember.updateMany({
    where: { id: memberId, roster: { rootTournamentId: rootId } },
    data: { status },
  })
  if (count === 0) throw new Error('Roster member not found')

  await revalidateRosterScope(tournamentId, rootId)
}

export async function removeRosterMember(tournamentId: string, memberId: string) {
  const rootId = await requireLeagueRootAdmin(tournamentId)

  const { count } = await prisma.leagueRosterMember.deleteMany({
    where: { id: memberId, roster: { rootTournamentId: rootId } },
  })
  if (count === 0) throw new Error('Roster member not found')

  await revalidateRosterScope(tournamentId, rootId)
}

export async function toggleAutoAddNew(tournamentId: string, autoAddNew: boolean) {
  const rootId = await requireLeagueRootAdmin(tournamentId)

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
  const rootId = await requireLeagueRootAdmin(tournamentId)

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
  const rootId = await requireLeagueRootAdmin(tournamentId)

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

  // Pre-generate ids for the users we're about to create so the whole import
  // can run as a handful of batched statements. The old shape was up to 3
  // sequential awaits per row inside the transaction, which risks the tx
  // timeout on a large CSV.
  const newUsers: { id: string; email: string; name?: string }[] = []
  for (const row of cleanRows) {
    if (!row.email || userIdByEmail.has(row.email)) continue
    const id = crypto.randomUUID()
    newUsers.push({ id, email: row.email, name: row.name })
    userIdByEmail.set(row.email, id)
  }

  // Rows that resolve to a user, deduped — a CSV can list the same email twice.
  const resolvedRows: { userId: string; row: (typeof cleanRows)[number] }[] = []
  const seenUserIds = new Set<string>()
  for (const row of cleanRows) {
    const userId = row.email ? userIdByEmail.get(row.email) : undefined
    // Phone-only rows can't create a User without an email — skip the
    // PlayerProfile + LeagueRosterMember portion and just record the invite.
    if (!userId || seenUserIds.has(userId)) continue
    seenUserIds.add(userId)
    resolvedRows.push({ userId, row })
  }

  const existingProfiles = resolvedRows.length > 0
    ? await prisma.playerProfile.findMany({
        where: { userId: { in: resolvedRows.map((r) => r.userId) } },
        select: { userId: true },
      })
    : []
  const hasProfile = new Set(existingProfiles.map((p) => p.userId))

  // Partition roster work before opening the transaction.
  const newMembers: { rosterId: string; userId: string }[] = []
  const reactivateUserIds: string[] = []
  for (const { userId, row } of resolvedRows) {
    const existingStatus = memberStatusByUserId.get(userId)
    if (existingStatus === undefined) {
      newMembers.push({ rosterId: roster.id, userId })
      result.added += 1
    } else if (existingStatus === 'INACTIVE') {
      reactivateUserIds.push(userId)
      result.reactivated += 1
    } else {
      result.skipped += 1
      if (row.email) result.duplicateEmails.push(row.email)
    }
  }

  await prisma.$transaction(async (tx) => {
    // 1. Create users (no auth credentials — they verify via magic link).
    if (newUsers.length > 0) {
      await tx.user.createMany({
        data: newUsers.map((u) => ({ id: u.id, email: u.email, name: u.name })),
      })
    }

    // 2. PlayerProfile: createMany for the misses, per-row update for the hits.
    //    There's no bulk upsert, and handicap differs per row, so updates stay
    //    individual — but only for users who already had a profile AND a
    //    handicap in the CSV, which is the rare path.
    const profileCreates = resolvedRows.filter(({ userId }) => !hasProfile.has(userId))
    if (profileCreates.length > 0) {
      await tx.playerProfile.createMany({
        data: profileCreates.map(({ userId, row }) => ({
          userId,
          displayName: row.name,
          ...(row.handicap !== null && row.handicap !== undefined ? { handicap: row.handicap } : {}),
        })),
      })
    }
    const profileUpdates = resolvedRows.flatMap(({ userId, row }) =>
      hasProfile.has(userId) && row.handicap !== null && row.handicap !== undefined
        ? [{ userId, handicap: row.handicap }]
        : [],
    )
    for (const { userId, handicap } of profileUpdates) {
      await tx.playerProfile.update({ where: { userId }, data: { handicap } })
    }

    // 3. LeagueRosterMember.
    if (newMembers.length > 0) {
      await tx.leagueRosterMember.createMany({ data: newMembers })
    }
    if (reactivateUserIds.length > 0) {
      await tx.leagueRosterMember.updateMany({
        where: { rosterId: roster.id, userId: { in: reactivateUserIds } },
        data: { status: 'ACTIVE' },
      })
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
      }).catch((err) => console.error('[importRosterCsv] invite send failed:', err))
    }
  }

  await revalidateRosterScope(tournamentId, rootId)
  return result
}
