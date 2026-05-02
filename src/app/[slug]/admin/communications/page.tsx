export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateRoster } from '@/lib/roster-actions'
import { listAnnouncements } from '@/lib/league-announcements'
import { CommunicationsPanel } from '@/components/season/CommunicationsPanel'

export default async function AdminCommunicationsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, isLeague: true },
  })
  if (!tournament) return null

  // Communications is league-only — bounce non-league admins back to overview.
  if (!tournament.isLeague) redirect(`/${slug}/admin`)

  const [roster, announcements] = await Promise.all([
    getOrCreateRoster(tournament.id),
    listAnnouncements(tournament.id).catch(() => []),
  ])

  const rosterCount = roster?.members.length ?? 0
  const rosterActiveCount = roster?.members.filter((m) => m.status === 'ACTIVE').length ?? 0

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Communications
        </p>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">{tournament.name}</h1>
      </div>

      <CommunicationsPanel
        tournamentId={tournament.id}
        slug={slug}
        rosterCount={rosterCount}
        rosterActiveCount={rosterActiveCount}
        history={announcements.map((a) => ({
          id: a.id,
          subject: a.subject,
          bodyPreview: a.bodyPreview,
          channels: a.channels,
          sentAt: a.sentAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
          sentByName: a.sentByName,
          deliveryCount: a.deliveryCount,
          successCount: a.successCount,
          status: a.status,
          scheduledFor: a.scheduledFor?.toISOString() ?? null,
          kind: a.kind,
        }))}
      />
    </main>
  )
}
