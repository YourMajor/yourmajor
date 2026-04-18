import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent } from '@/components/ui/card'
import { PlusCircle } from 'lucide-react'
import { TournamentCardMenu } from '@/components/TournamentCardMenu'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  REGISTRATION: 'Upcoming',
  ACTIVE: 'Live',
  COMPLETED: 'Completed',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'outline',
  REGISTRATION: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
}

export default async function TournamentsPage() {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const memberships = await prisma.tournamentPlayer.findMany({
    where: { userId: user.id },
    include: {
      tournament: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          startDate: true,
          _count: { select: { players: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const joinedIds = memberships.map((m) => m.tournamentId)
  const openTournaments = await prisma.tournament.findMany({
    where: {
      status: { in: ['REGISTRATION', 'ACTIVE'] },
      tournamentType: { in: ['PUBLIC', 'OPEN'] },
      id: { notIn: joinedIds },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      startDate: true,
      _count: { select: { players: true } },
    },
    orderBy: { startDate: 'asc' },
    take: 10,
  })

  const managed = memberships.filter((m) => m.isAdmin && m.tournament.status !== 'COMPLETED')
  const playing = memberships.filter((m) => !m.isAdmin && m.tournament.status !== 'COMPLETED')
  const completed = memberships.filter((m) => m.tournament.status === 'COMPLETED')

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Tournaments</h1>
        <Link href="/tournaments/new">
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <PlusCircle className="w-4 h-4" />
            Create
          </Button>
        </Link>
      </div>

      {managed.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-lg">Organising</h2>
          {managed.map((m) => (
            <TournamentRow key={m.id} t={m.tournament} showAdmin handicap={m.handicap} />
          ))}
        </section>
      )}

      {playing.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-lg">Playing</h2>
          {playing.map((m) => (
            <TournamentRow key={m.id} t={m.tournament} showAdmin={false} handicap={m.handicap} />
          ))}
        </section>
      )}

      {memberships.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t joined any tournaments yet.
        </p>
      )}

      {openTournaments.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-lg">Open to Join</h2>
          {openTournaments.map((t) => (
            <TournamentRow key={t.id} t={t} showAdmin={false} />
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading font-semibold text-lg">Completed</h2>
          {completed.map((m) => (
            <TournamentRow key={m.id} t={m.tournament} showAdmin={m.isAdmin} handicap={m.handicap} />
          ))}
        </section>
      )}
    </main>
  )
}

function TournamentRow({
  t,
  showAdmin,
  handicap,
}: {
  t: { id: string; slug: string; name: string; status: string; startDate: Date | null; _count: { players: number } }
  showAdmin: boolean
  handicap?: number
}) {
  return (
    <Card className="relative overflow-visible">
      {/* Status tag — top left */}
      <div className="absolute top-0 left-0">
        {t.status === 'ACTIVE' ? (
          <span className="inline-flex items-center gap-1.5 rounded-br-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white bg-green-600">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Live
          </span>
        ) : (
          <span className={`inline-flex items-center rounded-br-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            t.status === 'REGISTRATION'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-muted text-muted-foreground'
          }`}>
            {STATUS_LABEL[t.status] ?? t.status}
          </span>
        )}
      </div>

      {/* Admin overflow menu — top right */}
      {showAdmin && (
        <div className="absolute top-1.5 right-1.5">
          <TournamentCardMenu
            slug={t.slug}
            tournamentId={t.id}
            tournamentName={t.name}
            showRenew={t.status === 'COMPLETED'}
          />
        </div>
      )}

      <CardContent className="flex items-center justify-between pt-8 pb-4 gap-4">
        <div className="min-w-0">
          <p className="text-lg font-heading font-bold truncate">{t.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t._count.players} player{t._count.players !== 1 ? 's' : ''}
            {t.startDate ? ` · ${new Date(t.startDate).toLocaleDateString()}` : ''}
            {handicap !== undefined ? ` · HCP ${handicap}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {t.status === 'REGISTRATION' && (
            <Link href={`/${t.slug}/register`} className={buttonVariants({ size: 'sm' }) + ' bg-primary text-primary-foreground hover:bg-primary/90'}>
              Register
            </Link>
          )}
          <Link href={`/${t.slug}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            View
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
