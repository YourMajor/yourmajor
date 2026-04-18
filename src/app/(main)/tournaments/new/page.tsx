import { prisma } from '@/lib/prisma'
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

  return <TournamentWizard renewalDefaults={renewalDefaults} />
}
