export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getPlayerSeasonStats } from '@/lib/season-standings'
import { PlayerSeasonHub } from '@/components/season/PlayerSeasonHub'
import { redirect } from 'next/navigation'

export default async function PlayerSeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  const { userId: queryUserId } = await searchParams

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true },
  })
  if (!tournament) return null

  const user = await getUser()

  // Use query userId if provided, otherwise use logged-in user
  const targetUserId = (typeof queryUserId === 'string' ? queryUserId : null) ?? user?.id
  if (!targetUserId) redirect(`/${slug}/season`)

  const stats = await getPlayerSeasonStats(tournament.id, targetUserId)
  if (!stats) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Player Not Found</h1>
        <p className="text-muted-foreground">This player hasn&apos;t participated in any events this season.</p>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <PlayerSeasonHub stats={stats} slug={slug} isOwnProfile={targetUserId === user?.id} />
    </main>
  )
}
