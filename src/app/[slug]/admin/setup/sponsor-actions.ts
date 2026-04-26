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
  link: httpsUrl.or(z.literal('')).optional(),
})

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
    link: String(formData.get('sponsorLink') ?? '').trim(),
  })
  if (!parsed.success) {
    return { error: 'Sponsor link and logo URL must be valid URLs (or left blank).' }
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      sponsorName: parsed.data.name || null,
      sponsorLogoUrl: parsed.data.logoUrl || null,
      sponsorLink: parsed.data.link || null,
    },
  })

  revalidatePath(`/${tournament.slug}`)
  revalidatePath(`/${tournament.slug}/admin/setup`)
  return { ok: true }
}
