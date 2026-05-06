'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, isTournamentAdmin } from '@/lib/auth'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'

// SponsorStrip renders sponsor.link directly as <a href>, so a javascript:
// URL would execute on click. z.string().url() accepts any well-formed URL
// scheme — restrict to https:// to block javascript:, data:, file:, etc.
const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https:\/\//i.test(u), { message: 'URL must start with https://' })

const sponsorSchema = z.object({
  name: z.string().trim().max(80).optional(),
  logoUrl: httpsUrl.or(z.literal('')).optional(),
  bannerUrl: httpsUrl.or(z.literal('')).optional(),
  link: httpsUrl.or(z.literal('')).optional(),
})

const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

async function uploadImage(
  file: File,
  pathPrefix: string,
): Promise<{ url: string } | { error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
    return { error: `Image must be one of: ${ALLOWED_IMAGE_EXTS.join(', ')}` }
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const { createHash } = await import('crypto')
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12)
  const path = `${pathPrefix}-${hash}.${ext}`

  const { supabaseAdmin } = await import('@/lib/supabase')
  const { error } = await supabaseAdmin.storage
    .from('logos')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '31536000',
    })
  if (error) return { error: error.message }
  const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
  return { url: data.publicUrl }
}

export async function updateSponsor(
  tournamentId: string,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireAuth()
  if (!(await isTournamentAdmin(user.id, tournamentId))) {
    return { error: 'You do not have permission to edit this tournament.' }
  }

  const tier = await getTournamentTier(tournamentId)
  if (!TIER_LIMITS[tier].sponsorPlacements) {
    return { error: 'Sponsor placements are available on the Club and Tour plans.' }
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { slug: true },
  })
  if (!tournament) return { error: 'Tournament not found.' }

  const parsed = sponsorSchema.safeParse({
    name: String(formData.get('sponsorName') ?? '').trim(),
    logoUrl: String(formData.get('sponsorLogoUrl') ?? '').trim(),
    bannerUrl: String(formData.get('sponsorBannerUrl') ?? '').trim(),
    link: String(formData.get('sponsorLink') ?? '').trim(),
  })
  if (!parsed.success) {
    return { error: 'Sponsor link, logo URL, and banner URL must be valid https URLs (or left blank).' }
  }

  // Resolution order for each image: uploaded file (always wins) → pasted URL
  // → null (clears the value). The form always submits both fields, so an
  // empty URL with no file means the admin cleared the existing image.
  const logoFile = formData.get('sponsorLogoFile') as File | null
  let logoUrl: string | null = parsed.data.logoUrl || null
  if (logoFile && logoFile.size > 0) {
    const result = await uploadImage(logoFile, `sponsor-logo-${tournamentId}`)
    if ('error' in result) return { error: result.error }
    logoUrl = result.url
  }

  const bannerFile = formData.get('sponsorBannerFile') as File | null
  let bannerUrl: string | null = parsed.data.bannerUrl || null
  if (bannerFile && bannerFile.size > 0) {
    const result = await uploadImage(bannerFile, `sponsor-banner-${tournamentId}`)
    if ('error' in result) return { error: result.error }
    bannerUrl = result.url
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      sponsorName: parsed.data.name || null,
      sponsorLogoUrl: logoUrl,
      sponsorBannerUrl: bannerUrl,
      sponsorLink: parsed.data.link || null,
    },
  })

  revalidatePath(`/${tournament.slug}`)
  revalidatePath(`/${tournament.slug}/admin/setup`)
  return { ok: true }
}
