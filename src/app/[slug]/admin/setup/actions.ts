'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, isTournamentAdmin } from '@/lib/auth'
import { containsProfanity, ProfanityError } from '@/lib/content-moderation'
import { getFormat } from '@/lib/formats/registry'
import type { FormatId } from '@/lib/formats/types'

const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

const FORMAT_IDS: [FormatId, ...FormatId[]] = [
  'STROKE_PLAY',
  'STROKE_PLAY_NET',
  'STABLEFORD',
  'MODIFIED_STABLEFORD',
  'BEST_BALL',
  'BEST_BALL_2',
  'BEST_BALL_4',
  'SCRAMBLE',
  'SHAMBLE',
  'MATCH_PLAY',
  'RYDER_CUP',
  'SKINS',
  'SKINS_GROSS',
  'SKINS_NET',
  'QUOTA',
  'CALLAWAY',
  'PEORIA',
  'CHAPMAN',
  'PINEHURST',
  'LOW_GROSS_LOW_NET',
]

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB color')
const updateTournamentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(250).optional(),
  slug: z.string().trim().min(1).max(80),
  primaryColor: hexColor,
  accentColor: hexColor,
  tournamentFormat: z.enum(FORMAT_IDS),
  powerupsEnabled: z.boolean(),
  powerupsPerPlayer: z.number().int().min(0).max(20),
  maxAttacksPerPlayer: z.number().int().min(0).max(10),
  distributionMode: z.enum(['DRAFT', 'RANDOM']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  leagueEndDate: z.string().optional(),
})

function parseIntOr(value: FormDataEntryValue | null, fallback: number): number {
  const n = parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : fallback
}

export async function updateTournament(
  tournamentId: string,
  currentSlug: string,
  currentLogo: string | null,
  currentHeaderImage: string | null,
  formData: FormData,
) {
  const user = await requireAuth()
  if (!(await isTournamentAdmin(user.id, tournamentId))) {
    throw new Error('Forbidden')
  }

  const rawSlug = String(formData.get('slug') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const rawDescription = formData.get('description')
  const parsed = updateTournamentSchema.parse({
    name: String(formData.get('name') ?? ''),
    description: rawDescription != null ? String(rawDescription) : undefined,
    slug: rawSlug,
    primaryColor: String(formData.get('primaryColor') ?? ''),
    accentColor: String(formData.get('accentColor') ?? ''),
    tournamentFormat: String(formData.get('tournamentFormat') ?? ''),
    powerupsEnabled: formData.get('powerupsEnabled') === 'on',
    powerupsPerPlayer: parseIntOr(formData.get('powerupsPerPlayer'), 3),
    maxAttacksPerPlayer: parseIntOr(formData.get('maxAttacksPerPlayer'), 1),
    distributionMode: String(formData.get('distributionMode') ?? 'DRAFT'),
    startDate: formData.get('startDate') ? String(formData.get('startDate')) : undefined,
    endDate: formData.get('endDate') ? String(formData.get('endDate')) : undefined,
    leagueEndDate: formData.get('leagueEndDate') ? String(formData.get('leagueEndDate')) : undefined,
  })

  // Re-fetch current state server-side for guards
  const currentTournament = await prisma.tournament.findUnique({ where: { id: tournamentId } })

  // Language filter for publicly discoverable tournaments
  if (currentTournament?.tournamentType === 'PUBLIC') {
    if (containsProfanity(parsed.name)) throw new ProfanityError('Tournament name')
    if (containsProfanity(parsed.description)) throw new ProfanityError('Tournament description')
  }

  const serverScoreCount = await prisma.score.count({
    where: { round: { tournamentId } },
  })
  const serverHasScores = serverScoreCount > 0

  // Format is the user-facing decision; handicap is derived from format's impliedHandicap.
  // Guard: don't allow format/handicap change once scores exist.
  const tournamentFormat = serverHasScores ? currentTournament!.tournamentFormat : parsed.tournamentFormat
  const formatDef = getFormat(tournamentFormat)
  const handicapSystem = serverHasScores
    ? currentTournament!.handicapSystem
    : (formatDef.impliedHandicap ?? 'NONE')

  // If powerups are locked (draft started or cards dealt), preserve existing values
  const currentDraft = await prisma.draft.findUnique({ where: { tournamentId } })
  const currentDealtCount = await prisma.playerPowerup.count({
    where: { tournamentPlayer: { tournamentId } },
  })
  const isLocked = !!(currentDraft?.status === 'ACTIVE' || currentDraft?.status === 'COMPLETED' || currentDealtCount > 0)

  const powerupsEnabled = isLocked ? currentTournament!.powerupsEnabled : parsed.powerupsEnabled
  const powerupsPerPlayer = isLocked ? currentTournament!.powerupsPerPlayer : parsed.powerupsPerPlayer
  const maxAttacksPerPlayer = isLocked ? currentTournament!.maxAttacksPerPlayer : parsed.maxAttacksPerPlayer
  const distributionMode = isLocked ? currentTournament!.distributionMode : parsed.distributionMode
  const logoFile = formData.get('logo') as File | null
  const headerFile = formData.get('headerImage') as File | null

  let logoUrl = currentLogo
  let headerImageUrl = currentHeaderImage

  const { supabaseAdmin } = await import('@/lib/supabase')

  // Use a content-hashed filename so each unique upload gets a fresh URL and
  // identical reuploads share an immutable cache entry. Avoids `?v=Date.now()`
  // cache busters that force a re-download on every page load.
  const hashBuffer = async (buf: Buffer): Promise<string> => {
    const { createHash } = await import('crypto')
    return createHash('sha256').update(buf).digest('hex').slice(0, 12)
  }

  if (logoFile && logoFile.size > 0) {
    const ext = logoFile.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      throw new Error(`Logo must be one of: ${ALLOWED_IMAGE_EXTS.join(', ')}`)
    }
    const buffer = Buffer.from(await logoFile.arrayBuffer())
    const hash = await hashBuffer(buffer)
    const path = `${tournamentId}-${hash}.${ext}`

    const { error } = await supabaseAdmin.storage
      .from('logos')
      .upload(path, buffer, {
        contentType: logoFile.type,
        upsert: true,
        cacheControl: '31536000',
      })

    if (!error) {
      const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
      logoUrl = data.publicUrl
    }
  }

  if (headerFile && headerFile.size > 0) {
    const ext = headerFile.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      throw new Error(`Header image must be one of: ${ALLOWED_IMAGE_EXTS.join(', ')}`)
    }
    const buffer = Buffer.from(await headerFile.arrayBuffer())
    const hash = await hashBuffer(buffer)
    const path = `${tournamentId}-${hash}.${ext}`

    const { error } = await supabaseAdmin.storage
      .from('headers')
      .upload(path, buffer, {
        contentType: headerFile.type,
        upsert: true,
        cacheControl: '31536000',
      })

    if (!error) {
      const { data } = supabaseAdmin.storage.from('headers').getPublicUrl(path)
      headerImageUrl = data.publicUrl
    }
  }

  // League root: only the season's end date is editable here (individual events
  //   manage their own dates). League event: single-day, startDate==endDate and
  //   round date follows. Standalone: both startDate and endDate.
  const isLeague = currentTournament?.isLeague === true
  const isLeagueRoot = isLeague && !currentTournament?.parentTournamentId
  const isLeagueEvent = isLeague && !!currentTournament?.parentTournamentId

  const dateFields: {
    startDate?: Date | null
    endDate?: Date | null
    leagueEndDate?: Date | null
  } = {}
  if (isLeagueRoot) {
    dateFields.leagueEndDate = parsed.leagueEndDate ? new Date(parsed.leagueEndDate) : null
  } else if (isLeagueEvent) {
    const eventDate = parsed.startDate ? new Date(parsed.startDate) : null
    dateFields.startDate = eventDate
    dateFields.endDate = eventDate
  } else {
    dateFields.startDate = parsed.startDate ? new Date(parsed.startDate) : null
    dateFields.endDate = parsed.endDate ? new Date(parsed.endDate) : null
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      name: parsed.name,
      ...(parsed.description !== undefined ? { description: parsed.description || null } : {}),
      slug: parsed.slug,
      primaryColor: parsed.primaryColor,
      accentColor: parsed.accentColor,
      tournamentFormat,
      handicapSystem,
      powerupsEnabled,
      powerupsPerPlayer,
      maxAttacksPerPlayer,
      distributionMode,
      ...dateFields,
      logo: logoUrl,
      headerImage: headerImageUrl,
    },
  })

  // Keep round dates in sync with the league event date so player-facing UIs
  // that read TournamentRound.date stay correct.
  if (isLeagueEvent && dateFields.startDate) {
    await prisma.tournamentRound.updateMany({
      where: { tournamentId },
      data: { date: dateFields.startDate },
    })
  }

  revalidatePath(`/${parsed.slug}`, 'layout')
  revalidatePath(`/${parsed.slug}/admin/setup`)
  // Season schedule table on the parent league reads from this event — refresh
  // the parent's slug rather than the entire site cache.
  if (isLeagueEvent && currentTournament?.parentTournamentId) {
    const parent = await prisma.tournament.findUnique({
      where: { id: currentTournament.parentTournamentId },
      select: { slug: true },
    })
    if (parent?.slug) revalidatePath(`/${parent.slug}`, 'layout')
  }

  if (parsed.slug !== currentSlug) {
    redirect(`/${parsed.slug}/admin/setup`)
  }
}
