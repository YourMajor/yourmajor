import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  // Super-admins (global Role.ADMIN) can access any tournament
  // Otherwise check per-tournament isAdmin flag
  if (user.role !== 'ADMIN') {
    const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { id: true } })
    if (!tournament) redirect(`/${slug}`)

    const membership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
      select: { isAdmin: true },
    })

    if (!membership?.isAdmin) redirect(`/${slug}`)
  }

  return <>{children}</>
}
