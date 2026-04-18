import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Settings, BarChart3, PenLine, Target, RefreshCw, Users, Calendar, Globe, Lock, Hash } from 'lucide-react'
import { CopyJoinCode } from './CopyJoinCode'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  REGISTRATION: { label: 'Registration', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-200' },
  ACTIVE: { label: 'Live', bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-200' },
  COMPLETED: { label: 'Completed', bg: 'text-muted-foreground bg-muted', text: 'text-foreground' },
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      _count: { select: { players: true, rounds: true } },
      rounds: { orderBy: { roundNumber: 'asc' }, take: 1, select: { date: true } },
    },
  })

  if (!tournament) return null

  const statusCfg = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.REGISTRATION
  const actions = [
    { href: `/${slug}/admin/setup`, icon: Settings, label: 'Tournament Settings', desc: 'Courses, dates, handicap system', show: true },
    { href: `/${slug}`, icon: BarChart3, label: 'View Leaderboard', desc: 'Live standings and stats', show: true },
    { href: `/${slug}/admin/scores`, icon: PenLine, label: 'Manage Scores', desc: 'Edit or enter player scores', show: true },
    { href: `/${slug}/admin/draft`, icon: Target, label: 'Draft Order & Start', desc: 'Set order, run the draft', show: tournament.powerupsEnabled },
    { href: `/tournaments/new?renew=${tournament.id}`, icon: RefreshCw, label: 'Renew Tournament', desc: 'Create a sequel tournament', show: tournament.status === 'COMPLETED' },
  ].filter((a) => a.show)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="px-6 py-5" style={{ backgroundColor: 'var(--color-primary)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">Admin Dashboard</p>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-white">{tournament.name}</h1>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-5 py-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Players</span>
            </div>
            <p className="text-2xl font-heading font-bold">{tournament._count.players}</p>
          </div>
          <div className="px-5 py-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rounds</span>
            </div>
            <p className="text-2xl font-heading font-bold">{tournament._count.rounds}</p>
          </div>
          <div className="px-5 py-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              {tournament.isOpenRegistration
                ? <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                : <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              }
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Registration</span>
            </div>
            <p className="text-2xl font-heading font-bold">{tournament.isOpenRegistration ? 'Open' : 'Invite'}</p>
          </div>
        </div>
      </div>

      {/* Join Code */}
      {tournament.joinCode && tournament.tournamentType !== 'INVITE' && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
            >
              <Hash className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tournament Code</p>
              <p className="text-lg font-mono font-bold tracking-widest">{tournament.joinCode}</p>
            </div>
          </div>
          <CopyJoinCode code={tournament.joinCode} />
        </div>
      )}

      {/* Action cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex items-center gap-4 rounded-xl border border-border px-5 py-4 transition-all hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 hover:shadow-sm"
          >
            <div
              className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors group-hover:bg-[var(--color-primary)] group-hover:text-white"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
            >
              <action.icon className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
