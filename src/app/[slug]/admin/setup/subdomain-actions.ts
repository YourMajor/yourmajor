'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth, isTournamentAdmin } from '@/lib/auth'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import { validateSubdomain } from '@/lib/subdomain'

export async function updateLeagueSubdomain(
  tournamentId: string,
  rawSubdomain: string,
): Promise<{ ok: true; subdomain: string | null } | { error: string }> {
  const user = await requireAuth()
  if (!(await isTournamentAdmin(user.id, tournamentId))) {
    return { error: 'You do not have permission to edit this league.' }
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, isLeague: true, slug: true },
  })
  if (!tournament) return { error: 'League not found.' }
  if (!tournament.isLeague) {
    return { error: 'Custom subdomains are only available on leagues.' }
  }

  const tier = await getTournamentTier(tournamentId)
  if (!TIER_LIMITS[tier].customSubdomain) {
    return { error: 'Custom subdomains are a Tour-plan feature.' }
  }

  // Empty value clears the subdomain.
  const trimmed = rawSubdomain.trim()
  if (!trimmed) {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { subdomain: null },
    })
    revalidatePath(`/${tournament.slug}/admin/setup`)
    return { ok: true, subdomain: null }
  }

  const validation = validateSubdomain(trimmed)
  if (!validation.valid) return { error: validation.error }

  // Check uniqueness across all tournaments. Same league keeping the same value
  // is fine — only collide if a different tournament has it.
  const collision = await prisma.tournament.findUnique({
    where: { subdomain: validation.normalized },
    select: { id: true },
  })
  if (collision && collision.id !== tournamentId) {
    return { error: 'That subdomain is already taken. Please choose another.' }
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { subdomain: validation.normalized },
  })

  revalidatePath(`/${tournament.slug}/admin/setup`)
  return { ok: true, subdomain: validation.normalized }
}
