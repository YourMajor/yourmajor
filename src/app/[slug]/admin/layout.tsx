import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getUser()
  if (!user) redirect(`/auth/login?next=/${slug}/admin`)

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      tournamentType: true,
      isLeague: true,
      powerupsEnabled: true,
    },
  })

  if (!tournament) redirect(`/${slug}`)

  // Super-admins (global Role.ADMIN) can access any tournament
  // Otherwise check per-tournament isAdmin flag
  if (user.role !== 'ADMIN') {
    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
      select: { isAdmin: true },
    })

    if (!membership?.isAdmin) redirect(`/${slug}`)
  }

  return (
    <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:min-h-screen">
      <AdminSidebar
        slug={slug}
        tournamentName={tournament.name}
        tournamentType={tournament.tournamentType}
        isLeague={tournament.isLeague}
        powerupsEnabled={tournament.powerupsEnabled}
      />
      <div className="min-w-0 px-4 py-6 lg:px-8 lg:py-8 w-full lg:max-w-[1600px]">{children}</div>
    </div>
  )
}
