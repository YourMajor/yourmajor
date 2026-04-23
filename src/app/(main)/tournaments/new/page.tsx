import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getUserTier } from '@/lib/stripe'
import { TournamentWizard, type RenewalDefaults } from './TournamentWizard'

export default async function NewTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ renew?: string }>
}) {
  const { renew } = await searchParams

  let renewalDefaults: RenewalDefaults | null = null

  if (renew) {
    const parent = await prisma.tournament.findUnique({
      where: { id: renew },
      include: {
        rounds: {
          include: { course: { select: { id: true, name: true, par: true } } },
          orderBy: { roundNumber: 'asc' },
        },
      },
    })

    if (parent) {
      renewalDefaults = {
        parentTournamentId: parent.id,
        isLeague: parent.isLeague,
        name: parent.name,
        description: parent.description ?? '',
        primaryColor: parent.primaryColor,
        accentColor: parent.accentColor,
        handicapSystem: parent.handicapSystem,
        powerupsEnabled: parent.powerupsEnabled,
        powerupsPerPlayer: parent.powerupsPerPlayer,
        maxAttacksPerPlayer: parent.maxAttacksPerPlayer,
        distributionMode: parent.distributionMode,
        isOpenRegistration: parent.isOpenRegistration,
        rounds: parent.rounds.map((r) => ({
          courseId: r.courseId,
          courseName: r.course.name,
          coursePar: r.course.par,
          teeMode: r.teeMode,
        })),
      }
    }
  }

  const user = await getUser()
  const userTier = user ? await getUserTier(user.id) : { tier: 'FREE' as const, expiresAt: null, proCredits: 0 }

  // If renewing a branded tournament as a free user with no credits, block
  const parentHadBranding = renewalDefaults
    ? renewalDefaults.primaryColor !== '#006747' || renewalDefaults.accentColor !== '#C9A84C'
    : false
  const requiresUpgrade = parentHadBranding && userTier.tier === 'FREE'

  return (
    <TournamentWizard
      renewalDefaults={renewalDefaults}
      hasLeague={userTier.tier === 'LEAGUE' || userTier.tier === 'CLUB'}
      userTier={userTier.tier}
      proCredits={userTier.proCredits}
      requiresUpgrade={requiresUpgrade}
    />
  )
}
