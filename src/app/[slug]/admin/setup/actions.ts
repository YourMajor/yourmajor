'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, isTournamentAdmin } from '@/lib/auth'

const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB color')
const updateTournamentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80),
  primaryColor: hexColor,
  accentColor: hexColor,
  handicapSystem: z.enum(['NONE', 'WHS', 'STABLEFORD', 'CALLAWAY', 'PEORIA']),
  powerupsEnabled: z.boolean(),
  powerupsPerPlayer: z.number().int().min(0).max(20),
  maxAttacksPerPlayer: z.number().int().min(0).max(10),
  distributionMode: z.enum(['DRAFT', 'RANDOM']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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
  const parsed = updateTournamentSchema.parse({
    name: String(formData.get('name') ?? ''),
    slug: rawSlug,
    primaryColor: String(formData.get('primaryColor') ?? ''),
    accentColor: String(formData.get('accentColor') ?? ''),
    handicapSystem: String(formData.get('handicapSystem') ?? ''),
    powerupsEnabled: formData.get('powerupsEnabled') === 'on',
    powerupsPerPlayer: parseIntOr(formData.get('powerupsPerPlayer'), 3),
    maxAttacksPerPlayer: parseIntOr(formData.get('maxAttacksPerPlayer'), 1),
    distributionMode: String(formData.get('distributionMode') ?? 'DRAFT'),
    startDate: formData.get('startDate') ? String(formData.get('startDate')) : undefined,
    endDate: formData.get('endDate') ? String(formData.get('endDate')) : undefined,
  })

  // Re-fetch current state server-side for guards
  const currentTournament = await prisma.tournament.findUnique({ where: { id: tournamentId } })
  const serverScoreCount = await prisma.score.count({
    where: { round: { tournamentId } },
  })
  const serverHasScores = serverScoreCount > 0

  // Guard: don't allow handicap system change once scores exist
  const handicapSystem = serverHasScores ? currentTournament!.handicapSystem : parsed.handicapSystem

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

  if (logoFile && logoFile.size > 0) {
    const ext = logoFile.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      throw new Error(`Logo must be one of: ${ALLOWED_IMAGE_EXTS.join(', ')}`)
    }
    const path = `${tournamentId}.${ext}`
    const buffer = Buffer.from(await logoFile.arrayBuffer())

    const { error } = await supabaseAdmin.storage
      .from('logos')
      .upload(path, buffer, { contentType: logoFile.type, upsert: true })

    if (!error) {
      const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
      logoUrl = `${data.publicUrl}?v=${Date.now()}`
    }
  }

  if (headerFile && headerFile.size > 0) {
    const ext = headerFile.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      throw new Error(`Header image must be one of: ${ALLOWED_IMAGE_EXTS.join(', ')}`)
    }
    const path = `${tournamentId}.${ext}`
    const buffer = Buffer.from(await headerFile.arrayBuffer())

    const { error } = await supabaseAdmin.storage
      .from('headers')
      .upload(path, buffer, { contentType: headerFile.type, upsert: true })

    if (!error) {
      const { data } = supabaseAdmin.storage.from('headers').getPublicUrl(path)
      headerImageUrl = `${data.publicUrl}?v=${Date.now()}`
    }
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      name: parsed.name,
      slug: parsed.slug,
      primaryColor: parsed.primaryColor,
      accentColor: parsed.accentColor,
      handicapSystem,
      powerupsEnabled,
      powerupsPerPlayer,
      maxAttacksPerPlayer,
      distributionMode,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      logo: logoUrl,
      headerImage: headerImageUrl,
    },
  })

  revalidatePath(`/${parsed.slug}`, 'layout')
  revalidatePath(`/${parsed.slug}/admin/setup`)

  if (parsed.slug !== currentSlug) {
    redirect(`/${parsed.slug}/admin/setup`)
  }
}
