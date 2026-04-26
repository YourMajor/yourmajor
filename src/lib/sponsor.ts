import { prisma } from '@/lib/prisma'

export type EffectiveSponsor = {
  name: string
  logoUrl: string | null
  link: string | null
} | null

/**
 * Resolve which sponsor to show for a tournament.
 *
 * Order of precedence:
 *   1. Tournament's own sponsor fields (event-level override)
 *   2. The root tournament's sponsor fields (league-level default)
 *   3. null (no sponsor configured)
 *
 * A sponsor counts as "set" only if `sponsorName` is present. Logo and link
 * are optional refinements — sponsor name is the load-bearing field.
 */
export async function getEffectiveSponsor(tournamentId: string): Promise<EffectiveSponsor> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      sponsorName: true,
      sponsorLogoUrl: true,
      sponsorLink: true,
      parentTournamentId: true,
    },
  })
  if (!tournament) return null

  if (tournament.sponsorName) {
    return {
      name: tournament.sponsorName,
      logoUrl: tournament.sponsorLogoUrl ?? null,
      link: tournament.sponsorLink ?? null,
    }
  }

  if (tournament.parentTournamentId) {
    const root = await prisma.tournament.findUnique({
      where: { id: tournament.parentTournamentId },
      select: { sponsorName: true, sponsorLogoUrl: true, sponsorLink: true },
    })
    if (root?.sponsorName) {
      return {
        name: root.sponsorName,
        logoUrl: root.sponsorLogoUrl ?? null,
        link: root.sponsorLink ?? null,
      }
    }
  }

  return null
}
