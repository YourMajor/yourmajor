'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import { CountUp } from '@/components/motion/CountUp'
import { FindTournament } from '@/components/FindTournament'
import { buttonVariants } from '@/components/ui/button-variants'

// No-op subscribe — greeting is computed on mount, doesn't need to react to changes.
const noopSubscribe = () => () => {}

export interface HeroRound {
  course: string
  tournament: string
  slug: string
  gross: number
  diff: number
  thru: number
  complete: boolean
  live: boolean
}

interface DashboardHeroProps {
  displayName: string
  handicap: number
  totalRounds: number
  scoringAvg: number | null
  activeTournamentCount: number
  round: HeroRound | null
}

function greetingFor(hour: number, firstName: string) {
  if (hour >= 5 && hour < 12) return `Good morning, ${firstName}.`
  if (hour >= 12 && hour < 18) return `Good afternoon, ${firstName}.`
  if (hour >= 18 && hour < 22) return `Good evening, ${firstName}.`
  return `Late night, ${firstName}?`
}

function subheadFor(activeCount: number, round: HeroRound | null): string {
  if (round && !round.complete) {
    return activeCount > 1
      ? `You've got ${activeCount} active tournaments and a round waiting to be scored.`
      : `Your round is waiting — pick up where you left off.`
  }
  if (activeCount === 0) return `No active events. Find one open near you, or start your own.`
  if (activeCount === 1) return `One active tournament on your card.`
  return `${activeCount} active tournaments on your card.`
}

const fmtDiff = (d: number) => (d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`)

export function DashboardHero({
  displayName,
  handicap,
  totalRounds,
  scoringAvg,
  activeTournamentCount,
  round,
}: DashboardHeroProps) {
  const firstName = displayName.split(' ')[0]
  // Read client hour on mount, SSR falls back to neutral "Welcome" to avoid hydration mismatch.
  const greeting = useSyncExternalStore(
    noopSubscribe,
    () => greetingFor(new Date().getHours(), firstName),
    () => `Welcome, ${firstName}.`,
  )

  return (
    <section className="relative w-full overflow-hidden">
      {/* Ambient wash — the green and gold breathe onto the paper, softly */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 500px at 20% -10%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 60%),' +
            'radial-gradient(900px 400px at 90% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 55%)',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-10 sm:pt-16 sm:pb-14">
        <div className="text-center space-y-3">
          <h1
            className="font-heading font-semibold text-foreground"
            style={{
              fontSize: 'clamp(2.5rem, 4.5vw, 4rem)',
              letterSpacing: '-0.015em',
              lineHeight: 1.05,
            }}
          >
            {greeting}
          </h1>
          <p
            className="text-muted-foreground mx-auto max-w-xl"
            style={{ fontSize: '1rem', lineHeight: 1.6 }}
          >
            {subheadFor(activeTournamentCount, round)}
          </p>
        </div>

        {/* The locker plate: the one card pinned above everything else.
            A round in progress leads with its number; otherwise the plate
            is the player's own line — handicap, rounds, average. */}
        <div className="mt-10 sm:mt-12 max-w-2xl mx-auto plate overflow-hidden">
          <div aria-hidden className="h-0.5 w-full" style={{ background: 'var(--accent)' }} />

          {round && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 px-5 py-4 border-b border-foreground/8">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold truncate">
                  {round.live && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground"
                      style={{ background: 'var(--primary)' }}
                    >
                      <span aria-hidden className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />
                      Live
                    </span>
                  )}
                  <span className="truncate">{round.course}</span>
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {round.tournament} · thru {round.thru}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 shrink-0 sm:justify-start">
                <p className="tabular-data text-2xl leading-none">
                  <CountUp to={round.gross} duration={700} />
                  <span
                    className="ml-1.5 text-sm align-middle"
                    style={{ color: round.diff < 0 ? 'var(--score-birdie)' : 'var(--muted-foreground)' }}
                  >
                    ({fmtDiff(round.diff)})
                  </span>
                </p>
                <Link
                  href={`/${round.slug}${round.complete ? '' : '/play'}`}
                  className={buttonVariants({ variant: round.complete ? 'outline' : 'default', size: 'sm' })}
                >
                  {round.complete ? 'View round' : 'Resume scoring'}
                </Link>
              </div>
            </div>
          )}

          {/* The player's line, set like a scorecard row */}
          <dl className="grid grid-cols-3 divide-x divide-foreground/8">
            <PlateStat label="Handicap" value={handicap} decimals={handicap % 1 === 0 ? 0 : 1} />
            <PlateStat label="Rounds" value={totalRounds} />
            <PlateStat
              label="Avg vs Par"
              value={scoringAvg ?? 0}
              decimals={1}
              signed={scoringAvg !== null}
              placeholder={scoringAvg === null ? '—' : undefined}
              good={scoringAvg !== null && scoringAvg < 0}
            />
          </dl>
        </div>

        <div className="mt-8 flex flex-row items-center justify-center gap-3">
          <FindTournament
            triggerClassName={buttonVariants({ variant: 'outline' }) + ' bg-card/80 backdrop-blur-sm'}
          />
          <Link href="/tournaments/new" className={buttonVariants()}>
            <PlusCircle className="w-4 h-4" />
            Create Tournament
          </Link>
        </div>
      </div>
    </section>
  )
}

interface PlateStatProps {
  label: string
  value: number
  decimals?: number
  signed?: boolean
  placeholder?: string
  good?: boolean
}

function PlateStat({ label, value, decimals = 0, signed = false, placeholder, good = false }: PlateStatProps) {
  return (
    <div className="px-4 py-3.5 text-center">
      <dd
        className="tabular-data text-xl sm:text-2xl leading-none"
        style={good ? { color: 'var(--score-birdie)' } : undefined}
      >
        {placeholder ?? <CountUp to={value} decimals={decimals} signed={signed} />}
      </dd>
      <dt className="mt-1.5 text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
        {label}
      </dt>
    </div>
  )
}
