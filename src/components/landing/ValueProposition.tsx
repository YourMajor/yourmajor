'use client'

import Link from 'next/link'
import { useInView } from '@/hooks/useInView'
import { useEffect, useState, type ReactNode } from 'react'

/* ── Mini Leaderboard — animated row swap ────────────── */
function LeaderboardMini() {
  const [phase, setPhase] = useState(0) // 0 = initial, 1 = hogan moves up

  useEffect(() => {
    const timer = setTimeout(() => setPhase(1), 2500)
    const reset = setTimeout(() => setPhase(0), 5500)
    const interval = setInterval(() => {
      setTimeout(() => setPhase(1), 0)
      setTimeout(() => setPhase(0), 3000)
    }, 6000)
    return () => { clearTimeout(timer); clearTimeout(reset); clearInterval(interval) }
  }, [])

  // Phase 0: normal order. Phase 1: Watson (-3 → -5) jumps to #1
  const rows = phase === 0
    ? [
        { pos: '1', name: 'J. Palmer', score: '-4', highlight: false },
        { pos: '2', name: 'T. Watson', score: '-3', highlight: false },
        { pos: '3', name: 'B. Hogan', score: '-1', highlight: false },
        { pos: '4T', name: 'S. Snead', score: 'E', highlight: false },
        { pos: '4T', name: 'G. Player', score: 'E', highlight: false },
      ]
    : [
        { pos: '1', name: 'T. Watson', score: '-5', highlight: true },
        { pos: '2', name: 'J. Palmer', score: '-4', highlight: false },
        { pos: '3', name: 'B. Hogan', score: '-1', highlight: false },
        { pos: '4T', name: 'S. Snead', score: 'E', highlight: false },
        { pos: '4T', name: 'G. Player', score: 'E', highlight: false },
      ]

  const scoreColor = (s: string) =>
    s.startsWith('-') ? 'oklch(0.50 0.20 25)' : s === 'E' ? 'oklch(0.17 0.03 250)' : 'oklch(0.50 0.02 250)'

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'oklch(0.985 0.002 250)' }}>
      <div className="grid grid-cols-[28px_1fr_36px] text-[9px] uppercase tracking-wider font-semibold text-white px-2.5 py-1.5"
           style={{ background: 'oklch(0.30 0.08 255)', borderBottom: '2px solid oklch(0.72 0.11 78)' }}>
        <span className="text-center">Pos</span><span>Player</span><span className="text-center">Tot</span>
      </div>
      {rows.map((row, i) => (
        <div key={row.name}
          className="grid grid-cols-[28px_1fr_36px] items-center px-2.5 py-1.5 text-[11px] transition-all duration-700"
          style={{
            background: row.highlight ? 'oklch(0.50 0.20 25 / 0.06)' : i % 2 === 1 ? 'oklch(0.97 0.003 95)' : 'white',
            borderBottom: '1px solid oklch(0.88 0.01 140)',
          }}>
          <span className="text-center font-bold transition-all duration-500" style={{ color: 'oklch(0.30 0.08 255)' }}>{row.pos}</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0 transition-all duration-500 ${row.highlight ? 'ring-1 ring-amber-400/50' : ''}`}
                 style={{ background: 'oklch(0.30 0.08 255)', color: 'white' }}>{row.name.split(' ').map(n => n[0]).join('')}</div>
            <span className={`truncate transition-all duration-500 ${row.highlight ? 'font-semibold' : ''}`} style={{ color: 'oklch(0.17 0.03 250)' }}>{row.name}</span>
          </div>
          <span className="text-center font-bold font-mono transition-all duration-500" style={{ color: scoreColor(row.score) }}>{row.score}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Mini Live Scoring — animated stepper ────────────── */
function ScoringMini() {
  const [strokes, setStrokes] = useState(4)
  const [tapping, setTapping] = useState(false)

  useEffect(() => {
    // Animate: start at 4, tap down to 3 after delay, then cycle
    const sequence = () => {
      setTimeout(() => { setTapping(true) }, 2000)
      setTimeout(() => { setStrokes(3); setTapping(false) }, 2300)
      setTimeout(() => { setTapping(true) }, 5000)
      setTimeout(() => { setStrokes(4); setTapping(false) }, 5300)
    }
    sequence()
    const interval = setInterval(sequence, 7000)
    return () => clearInterval(interval)
  }, [])

  const par = 4
  const diff = strokes - par
  const badge = diff < 0 ? { label: 'Birdie', bg: 'oklch(0.50 0.20 25 / 0.2)', color: 'oklch(0.50 0.20 25)' }
    : diff === 0 ? { label: 'Par', bg: 'white/10', color: 'white/80' }
    : { label: 'Bogey', bg: 'white/5', color: 'white/60' }

  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: 'oklch(0.28 0.07 255)' }}>
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <div>
          <span className="text-lg font-bold font-heading text-white">Hole 7</span>
          <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] font-bold transition-all duration-300"
                style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
        </div>
        <div className="text-right">
          <span className="text-[8px] text-white/40 uppercase tracking-wider block">Score</span>
          <span className="text-sm font-bold text-white transition-all duration-300">
            {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
          </span>
        </div>
      </div>
      <div className="h-px bg-white/10" />
      {/* Stepper */}
      <div className="flex items-center justify-center gap-4 py-4">
        <div className={`w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-sm font-bold transition-transform duration-150 ${tapping ? 'scale-90 bg-white/25' : ''}`}>−</div>
        <span className="text-4xl font-heading font-bold text-white tabular-nums transition-all duration-200" key={strokes}>{strokes}</span>
        <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-sm font-bold">+</div>
      </div>
      {/* Toggles */}
      <div className="px-3 pb-3 space-y-1">
        {[{ label: 'Fairway', on: true }, { label: 'GIR', on: strokes <= par }].map(s => (
          <div key={s.label} className="flex items-center justify-between py-1">
            <span className="text-[10px] font-semibold text-white/70">{s.label}</span>
            <div className={`w-7 h-3.5 rounded-full relative transition-all duration-300 ${s.on ? '' : 'bg-white/15'}`}
                 style={s.on ? { background: 'oklch(0.72 0.11 78)' } : {}}>
              <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all duration-300 ${s.on ? 'left-[14px]' : 'left-0.5'}`} />
            </div>
          </div>
        ))}
      </div>
      {/* Hole dots */}
      <div className="flex justify-center gap-1 pb-2.5">
        {['bg-red-500','bg-red-500','bg-white/25','bg-white/25','bg-gray-700','bg-white/25','ring-1 ring-accent','border border-white/30','border border-white/30'].map((c, i) => (
          <div key={i} className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white ${c}`}>{i+1}</div>
        ))}
      </div>
    </div>
  )
}

/* ── Powerups — fanned hand like CardHand component ──── */
function PowerupsMini() {
  const cards = [
    { name: 'Fairway Finder', type: 'BOOST' as const, duration: '3 Holes', icon: '🌲' },
    { name: 'The Sandman', type: 'ATTACK' as const, duration: '1 Hole', icon: '⛏️' },
    { name: 'Stroke Swap', type: 'ATTACK' as const, duration: '1 Stroke', icon: '⚔️' },
    { name: 'Go For Glory', type: 'BOOST' as const, duration: '1 Hole · 2×', icon: '🏆' },
    { name: 'Happy Gilmore', type: 'BOOST' as const, duration: '3 Holes', icon: '😄' },
  ]

  const totalCards = cards.length
  const maxSpread = Math.min(totalCards * 7, 35)

  return (
    <div className="relative flex items-end justify-center" style={{ height: '180px' }}>
      {cards.map((card, i) => {
        const isBoost = card.type === 'BOOST'
        const iconColor = isBoost ? 'text-emerald-800' : 'text-red-700'
        const nameColor = isBoost ? 'text-emerald-900' : 'text-red-800'
        const borderFrame = isBoost ? 'border-emerald-800/25' : 'border-red-700/25'
        const infoColor = isBoost ? 'text-emerald-700/60' : 'text-red-600/60'

        const angle = -maxSpread / 2 + (i / (totalCards - 1)) * maxSpread
        const yOffset = Math.abs(i - (totalCards - 1) / 2) * 6
        const overlap = 24

        return (
          <div key={i}
            className="absolute rounded-2xl border-[3px] shadow-md flex flex-col overflow-hidden select-none
              hover:!-translate-y-5 hover:!rotate-0 hover:z-50 hover:shadow-xl transition-all duration-300"
            style={{
              width: '95px', height: '140px',
              background: '#f5f0e8',
              borderColor: isBoost ? 'rgb(6, 95, 70)' : 'rgb(185, 28, 28)',
              left: `calc(50% + ${(i - (totalCards - 1) / 2) * overlap}px - 47px)`,
              bottom: `${yOffset}px`,
              transform: `rotate(${angle}deg)`,
              transformOrigin: 'bottom center',
              zIndex: i + 1,
              animation: `heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.2 + i * 0.08}s both`,
            }}>
            <div className="flex items-start justify-between px-1.5 pt-1.5">
              <span className="text-base">{card.icon}</span>
              <span className={`text-[6px] font-bold uppercase tracking-widest mt-0.5 ${iconColor}`}>{card.type}</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-1.5">
              <div className={`w-full border-t border-b py-1.5 ${borderFrame}`}>
                <p className={`font-heading font-bold text-center leading-tight text-[9px] ${nameColor}`}>{card.name}</p>
              </div>
              <span className={`mt-0.5 text-[7px] font-semibold ${infoColor}`}>{card.duration}</span>
            </div>
            <div className="flex items-end justify-between px-1.5 pb-1.5">
              <span className={`text-[6px] font-bold uppercase tracking-widest ${iconColor}`}>{card.type}</span>
              <span className="text-base rotate-180">{card.icon}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Mini Custom Branding — matches TournamentHeader component ── */
function BrandingMini() {
  const tournaments = [
    { name: 'The Masters Cup', primary: 'oklch(0.30 0.08 255)', accent: 'oklch(0.72 0.11 78)', initials: 'MC', date: 'May 10 – 12', players: '24' },
    { name: 'Sunset Scramble', primary: 'oklch(0.35 0.12 25)', accent: 'oklch(0.78 0.11 55)', initials: 'SS', date: 'Jun 1', players: '16' },
  ]
  return (
    <div className="space-y-2.5">
      {tournaments.map((t, i) => (
        <div key={i} className="rounded-xl overflow-hidden shadow-md"
          style={{ animation: `heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.12}s both` }}>
          {/* Header — matches tournament-header class */}
          <div className="relative px-3 py-3 flex flex-col items-center text-center" style={{ background: t.primary }}>
            {/* Embossed logo badge — matches .tournament-logo-badge */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-heading font-bold text-white/90 overflow-hidden"
                 style={{
                   border: `2px solid color-mix(in oklch, ${t.primary}, white 30%)`,
                   boxShadow: '0 4px 16px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.12)',
                   background: `linear-gradient(160deg, color-mix(in oklch, ${t.primary}, white 10%), color-mix(in oklch, ${t.primary}, black 8%))`,
                 }}>
              {t.initials}
            </div>
            {/* Name */}
            <h3 className="text-[11px] font-heading font-bold text-white mt-1.5 tracking-tight">{t.name}</h3>
            {/* Date + status */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[8px] text-white/50">{t.date}</span>
              <span className="text-[8px] text-white/50">·</span>
              <span className="text-[8px] text-white/50">{t.players} players</span>
              <span className="inline-flex items-center gap-0.5 text-[7px] text-white font-bold uppercase tracking-wider bg-white/15 rounded-full px-1.5 py-0.5">
                <span className="h-1 w-1 rounded-full bg-green-400 animate-pulse" />Live
              </span>
            </div>
            {/* Accent divider — matches actual component */}
            <div className="w-8 h-0.5 rounded-full mt-2" style={{ background: t.accent }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Mini Stats/Insights ─────────────────────────────── */
function StatsMini() {
  const stats = [
    { label: 'Scoring Avg', value: '+2.4', accent: false },
    { label: 'Fairways', value: '64%', accent: true },
    { label: 'GIR', value: '44%', accent: false },
    { label: 'Putts/Rnd', value: '31.2', accent: false },
    { label: 'Best Round', value: '72', accent: true },
    { label: 'Rounds', value: '18', accent: false },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 h-full">
      {stats.map((s, i) => (
        <div key={i} className="rounded-lg bg-white/5 border border-white/8 p-3 flex flex-col items-center justify-center"
          style={{ animation: `heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.08}s both` }}>
          <div className={`text-xl font-bold font-heading tabular-nums ${s.accent ? 'text-accent' : 'text-white'}`}>{s.value}</div>
          <div className="text-[8px] text-white/40 uppercase tracking-wider mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Mini Chat ───────────────────────────────────────── */
function ChatMini() {
  const messages = [
    { name: 'JP', text: 'Just birdied 7! 🔥', align: 'left' as const },
    { name: 'TW', text: 'Nice one. I\'m using my mulligan on 9', align: 'right' as const },
    { name: 'BH', text: 'Someone activated Stroke Swap on me 😤', align: 'left' as const },
  ]
  return (
    <div className="space-y-2">
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.align === 'right' ? 'justify-end' : 'justify-start'}`}
          style={{ animation: `heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.4 + i * 0.15}s both` }}>
          <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 ${m.align === 'right' ? 'bg-accent/20 rounded-br-sm' : 'bg-white/8 rounded-bl-sm'}`}>
            <span className="text-[9px] font-bold text-white/50 block">{m.name}</span>
            <span className="text-[11px] text-white/80">{m.text}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Feature card data ───────────────────────────────── */
interface Feature {
  title: string
  description: string
  visual: ReactNode
}

const FEATURES: Feature[] = [
  {
    title: 'Live Leaderboards',
    description: 'Real-time scoring that keeps every player connected, hole by hole.',
    visual: <LeaderboardMini />,
  },
  {
    title: 'Live Scoring',
    description: 'Score from your phone — strokes, putts, fairways, greens in regulation.',
    visual: <ScoringMini />,
  },
  {
    title: 'Powerups',
    description: 'Draft powerup cards before each round and deploy them mid-play.',
    visual: <PowerupsMini />,
  },
  {
    title: 'Custom Branding',
    description: 'Colors, logos, and embossed badges — every tournament gets its own identity.',
    visual: <BrandingMini />,
  },
  {
    title: 'Stats & Insights',
    description: 'Scoring averages, fairway percentages, GIR, and round-over-round trends.',
    visual: <StatsMini />,
  },
  {
    title: 'Tournament Chat',
    description: 'Built-in group chat keeps the banter going from the first tee to the 19th hole.',
    visual: <ChatMini />,
  },
]

export function ValueProposition() {
  const [ref, isInView] = useInView<HTMLDivElement>({ threshold: 0.1 })

  return (
    <section className="pt-10 sm:pt-16 lg:pt-20 pb-4 sm:pb-6 lg:pb-8">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8">
        <h2 className="font-heading text-xl sm:text-2xl lg:text-4xl font-bold text-white">
          Built for <span className="text-accent">competitive</span> golfers
        </h2>
        <p className="mt-2 text-white/50 text-xs sm:text-sm lg:text-lg max-w-lg lg:max-w-xl">
          Everything you need to run tournament golf — from casual weekend events to season-long leagues.
        </p>
      </div>

      {/* Horizontal scroll container — pb-4 reserves space for hover lift */}
      <div
        ref={ref}
        className="overflow-x-auto pt-2 pb-4 -mt-2 scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex gap-3 sm:gap-4 lg:gap-5 px-4 sm:px-6 lg:px-8 w-max">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="w-[220px] sm:w-[280px] lg:w-[360px] xl:w-[400px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden
                transition-all duration-500 hover:bg-white/[0.06] hover:border-white/20 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20"
              style={{
                opacity: isInView ? 1 : 0,
                transform: isInView ? 'translateX(0)' : 'translateX(60px)',
                transition: `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`,
              }}
            >
              {/* Text */}
              <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 lg:pt-5 pb-1.5 sm:pb-2">
                <h3 className="font-heading text-xs sm:text-sm lg:text-base font-bold text-white mb-0.5 sm:mb-1">{feature.title}</h3>
                <p className="text-white/45 text-[10px] sm:text-xs lg:text-sm leading-relaxed">{feature.description}</p>
              </div>
              {/* Animated visual */}
              <div className="px-3 sm:px-4 lg:px-5 pb-3 sm:pb-4 lg:pb-5 pt-1">
                {feature.visual}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* See all features link — right after cards */}
      <div className="px-4 sm:px-6 lg:px-8 mt-0">
        <Link
          href="/features"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm lg:text-base font-semibold text-accent hover:text-accent/80 transition-colors"
        >
          See all features →
        </Link>
      </div>
    </section>
  )
}
