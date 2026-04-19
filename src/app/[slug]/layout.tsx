import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getTournamentTier } from '@/lib/stripe'
import { getChampionHistory, getLatestInChain, type PastChampion } from '@/lib/tournament-chain'
import { PersistentChat } from '@/components/hub/PersistentChat'
import { TournamentShell } from '@/components/leaderboard/TournamentShell'
import { TournamentProvider, type TournamentContextValue } from '@/components/TournamentContext'

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [tournament, user] = await Promise.all([
    prisma.tournament.findUnique({ where: { slug } }),
    getUser(),
  ])

  if (!tournament) notFound()

  const isEnded = tournament.status === 'ACTIVE' || tournament.status === 'COMPLETED'

  let showAdmin = user?.role === 'ADMIN'
  let isRegistered = false
  let isTournamentAdmin = false
  let avatarUrl: string | null = null
  let initials = '?'

  if (user) {
    const [membership, profile] = await Promise.all([
      prisma.tournamentPlayer.findUnique({
        where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
        select: { isAdmin: true, isParticipant: true },
      }),
      prisma.playerProfile.findUnique({
        where: { userId: user.id },
        select: { avatar: true, displayName: true },
      }),
    ])
    if (membership?.isAdmin) showAdmin = true
    isTournamentAdmin = membership?.isAdmin ?? false
    isRegistered = !!membership?.isParticipant
    avatarUrl = profile?.avatar ?? user.image ?? null
    const name = profile?.displayName ?? user.name ?? user.email.split('@')[0]
    initials = name
      .split(' ')
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  const showRegister = !!user && !isRegistered && !isEnded
  const deadlinePassed = tournament.registrationDeadline ? new Date() > new Date(tournament.registrationDeadline) : false
  const canLeave = isRegistered && tournament.status === 'REGISTRATION' && !deadlinePassed

  // Fetch gallery photos for the menu
  const galleryPhotos = await prisma.tournamentPhoto.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: 'desc' },
    select: { url: true, caption: true },
    take: 10,
  })
  const galleryUrls = galleryPhotos.map((p) => p.url)

  // Fetch champion history for renewed tournaments
  const hasVault = !!tournament.parentTournamentId
  const tournamentTier = await getTournamentTier(tournament.id)
  const hasSeason = hasVault || tournament.isLeague || tournamentTier === 'CLUB' || tournamentTier === 'LEAGUE'
  let champions: PastChampion[] = []
  if (hasVault) {
    champions = await getChampionHistory(tournament.id)
  }

  // Check if this is an older tournament in a chain (has a newer child)
  const latestTournament = await getLatestInChain(tournament.id)

  const ctx: TournamentContextValue = {
    slug,
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    logo: tournament.logo,
    headerImage: tournament.headerImage,
    primaryColor: tournament.primaryColor,
    accentColor: tournament.accentColor,
    status: tournament.status,
    startDate: tournament.startDate?.toISOString() ?? null,
    endDate: tournament.endDate?.toISOString() ?? null,
    isLoggedIn: !!user,
    isRegistered,
    avatarUrl,
    initials,
    showAdmin,
    showRegister,
    powerupsEnabled: tournament.powerupsEnabled,
    galleryImages: galleryUrls,
    champions,
    hasVault,
    hasSeason,
    latestTournament,
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{ '--color-primary': tournament.primaryColor, '--color-accent': tournament.accentColor } as React.CSSProperties}
      suppressHydrationWarning
    >
      <TournamentProvider value={ctx}>
        <TournamentShell
          slug={slug}
          tournamentName={tournament.name}
          logo={tournament.logo}
          headerImage={tournament.headerImage}
          primaryColor={tournament.primaryColor}
          accentColor={tournament.accentColor}
          status={tournament.status}
          startDate={tournament.startDate?.toISOString() ?? null}
          endDate={tournament.endDate?.toISOString() ?? null}
          isLoggedIn={!!user}
          isRegistered={isRegistered}
          avatarUrl={avatarUrl}
          initials={initials}
          showAdmin={showAdmin}
          showRegister={showRegister}
          powerupsEnabled={tournament.powerupsEnabled}
          galleryImages={galleryUrls}
          champions={champions}
          hasVault={hasVault}
          canLeave={canLeave}
        >
          {children}
        </TournamentShell>

        <PersistentChat
          tournamentId={tournament.id}
          currentUserId={user?.id ?? null}
          currentUserName={user?.name ?? null}
          isRegistered={isRegistered}
        />
      </TournamentProvider>
    </div>
  )
}
