'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import { CountUp } from '@/components/motion/CountUp'
import { FindTournament } from '@/components/FindTournament'

// No-op subscribe — greeting is computed on mount, doesn't need to react to changes.
const noopSubscribe = () => () => {}

interface DashboardHeroProps {
  displayName: string
  handicap: number
  totalRounds: number
  scoringAvg: number | null
  activeTournamentCount: number
  hasActiveRoundToScore: boolean
}

function greetingFor(hour: number, firstName: string) {
  if (hour >= 5 && hour < 12) return `Good morning, ${firstName}.`
  if (hour >= 12 && hour < 18) return `Good afternoon, ${firstName}.`
  if (hour >= 18 && hour < 22) return `Good evening, ${firstName}.`
  return `Late night, ${firstName}?`
}

function subheadFor(activeCount: number, hasRound: boolean): string {
  if (hasRound) {
    return activeCount > 1
      ? `You've got ${activeCount} active tournaments and a round waiting to be scored.`
      : `Your round is waiting — pick up where you left off.`
  }
  if (activeCount === 0) return `No active events. Find one open near you, or start your own.`
  if (activeCount === 1) return `One active tournament on your card.`
  return `${activeCount} active tournaments on your card.`
}

export function DashboardHero({
  displayName,
  handicap,
  totalRounds,
  scoringAvg,
  activeTournamentCount,
  hasActiveRoundToScore,
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
      {/* Ambient gradient orbs — soft brand accents on a near-white canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 500px at 20% -10%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 60%),' +
            'radial-gradient(900px 400px at 90% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 55%)',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-14 pb-14 sm:pt-20 sm:pb-20">
        {/* Greeting — typography-led centerpiece */}
        <div className="text-center space-y-3">
          <h1
            className="font-heading font-semibold text-foreground"
            style={{
              fontSize: 'clamp(2.25rem, 6vw, 4rem)',
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
            }}
          >
            {greeting}
          </h1>
          <p
            className="text-muted-foreground mx-auto max-w-xl"
            style={{
              fontSize: 'clamp(1rem, 1.6vw, 1.15rem)',
              lineHeight: 1.5,
            }}
          >
            {subheadFor(activeTournamentCount, hasActiveRoundToScore)}
          </p>
        </div>

        {/* Stat trio — big numerals */}
        <div className="mt-10 sm:mt-14 grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto">
          <HeroStat label="Handicap" value={handicap} decimals={handicap % 1 === 0 ? 0 : 1} />
          <HeroStat label="Rounds" value={totalRounds} />
          <HeroStat
            label="Avg vs Par"
            value={scoringAvg ?? 0}
            decimals={1}
            signed={scoringAvg !== null}
            muted={scoringAvg === null}
            placeholder={scoringAvg === null ? '—' : undefined}
          />
        </div>

        {/* Actions — subtle horizontal strip */}
        <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row items-center justify-center gap-3">
          <FindTournament triggerClassName="inline-flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white/80 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-foreground/90 hover:bg-white transition-all shadow-sm hover:shadow-md" />
          <Link
            href="/tournaments/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:shadow-md transition-all"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <PlusCircle className="w-4 h-4" />
            Create Tournament
          </Link>
        </div>
      </div>
    </section>
  )
}

interface HeroStatProps {
  label: string
  value: number
  decimals?: number
  signed?: boolean
  muted?: boolean
  placeholder?: string
}

function HeroStat({ label, value, decimals = 0, signed = false, muted = false, placeholder }: HeroStatProps) {
  return (
    <div className="text-center">
      <div
        className={`font-heading font-semibold tabular-nums ${muted ? 'text-muted-foreground/60' : 'text-foreground'}`}
        style={{
          fontSize: 'clamp(2rem, 5.5vw, 3.25rem)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        {placeholder ?? <CountUp to={value} decimals={decimals} signed={signed} />}
      </div>
      <div className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
        {label}
      </div>
    </div>
  )
}
