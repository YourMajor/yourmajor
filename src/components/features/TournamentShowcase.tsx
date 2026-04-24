'use client'

import { useState, useEffect } from 'react'
import { CalendarClock } from 'lucide-react'

const TOURNAMENTS = [
  {
    name: 'The Backyard Classic',
    primary: '#1A5632',
    accent: '#D4AF37',
    handicap: 'Stableford',
    type: 'Invite Only',
    status: 'Live',
    statusCls: 'bg-green-600 text-white',
    statusDot: true,
    players: 24,
    rounds: 2,
    course: 'Pebble Creek GC',
    par: 72,
    date: 'Apr 19 – Apr 20',
    initial: 'B',
    description: 'Annual scramble with the crew. Powerups on. No mercy.',
  },
  {
    name: 'City Championship',
    primary: '#2C3E7B',
    accent: '#E8563A',
    handicap: 'WHS',
    type: 'Public',
    status: 'Upcoming',
    statusCls: 'bg-white/20 text-white',
    statusDot: false,
    players: 64,
    rounds: 4,
    course: 'Pine Valley CC',
    par: 71,
    date: 'May 3 – May 6',
    initial: 'C',
    description: 'Open to all players. WHS net scoring with four competitive rounds.',
  },
  {
    name: 'Summer Skins',
    primary: '#6B2D5B',
    accent: '#FFD700',
    handicap: 'Callaway',
    type: 'Open',
    status: 'Live',
    statusCls: 'bg-green-600 text-white',
    statusDot: true,
    players: 16,
    rounds: 1,
    course: 'Sunset Ridge',
    par: 70,
    date: 'Apr 22',
    initial: 'S',
    description: 'One round. Callaway handicap. Winner takes all.',
  },
]

export function TournamentShowcase() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % TOURNAMENTS.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [])

  const t = TOURNAMENTS[index]

  return (
    <div className="rounded-lg overflow-hidden shadow-lg max-w-xs lg:max-w-sm mx-auto md:mx-0 border border-border">
      {/* Branded header strip — matches TournamentCard */}
      <div
        className="relative px-3 py-2.5 flex items-center transition-all duration-700 ease-in-out"
        style={{
          background: `linear-gradient(135deg, ${t.primary}, ${t.primary}dd)`,
        }}
      >
        {/* Accent stripe */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-700"
          style={{ backgroundColor: t.accent }}
        />

        {/* Logo + Name */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-base font-heading font-bold text-white shrink-0 border-2 transition-all duration-700"
            style={{ backgroundColor: `${t.primary}80`, borderColor: t.accent }}
          >
            {t.initial}
          </div>
          <div className="min-w-0">
            <p className="font-heading font-semibold text-white truncate text-sm lg:text-base">{t.name}</p>
            <p className="text-[11px] lg:text-xs text-white/70 truncate">
              {t.course} (Par {t.par})
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="absolute top-1.5 right-2">
          <span className={`inline-flex items-center gap-1.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${t.statusCls}`}>
            {t.statusDot && (
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            )}
            {t.status}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="bg-card px-3 py-2.5 space-y-1.5">
        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center text-[11px] lg:text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            {t.date}
          </span>
          <span className="inline-flex items-center text-[11px] lg:text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            {t.players} players
          </span>
          <span
            className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md text-white transition-all duration-700"
            style={{ backgroundColor: t.primary }}
          >
            {t.handicap}
          </span>
          <span className="inline-flex items-center text-[11px] lg:text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            {t.rounds} round{t.rounds !== 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] lg:text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            <CalendarClock className="w-3 h-3" />
            {t.type}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs lg:text-sm text-muted-foreground line-clamp-2">{t.description}</p>
      </div>

      {/* Dots */}
      <div className="px-3 py-2 bg-card border-t border-border flex items-center justify-center gap-1.5">
        {TOURNAMENTS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
