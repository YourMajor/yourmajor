'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import {
  BarChart3, ClipboardList, Zap, Users, Camera, Shield,
  MessageSquare, TrendingUp, Map, Smartphone, Settings,
  Bell, Repeat, Timer, Globe, Crosshair, Palette, Trophy,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════
   ANIMATED VISUAL MOCKUPS
   ═══════════════════════════════════════════════════════ */

/* ── Leaderboard with live row swap ────────────────── */
function LeaderboardVisual() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const go = () => { setTimeout(() => setPhase(1), 0); setTimeout(() => setPhase(0), 3000) }
    const t = setTimeout(go, 2500)
    const i = setInterval(go, 6000)
    return () => { clearTimeout(t); clearInterval(i) }
  }, [])

  const rows = phase === 0
    ? [
        { pos: '1', name: 'J. Palmer', score: '-4', hl: false },
        { pos: '2', name: 'T. Watson', score: '-3', hl: false },
        { pos: '3', name: 'B. Hogan', score: '-1', hl: false },
        { pos: '4T', name: 'S. Snead', score: 'E', hl: false },
        { pos: '4T', name: 'G. Player', score: 'E', hl: false },
      ]
    : [
        { pos: '1', name: 'T. Watson', score: '-5', hl: true },
        { pos: '2', name: 'J. Palmer', score: '-4', hl: false },
        { pos: '3', name: 'B. Hogan', score: '-1', hl: false },
        { pos: '4T', name: 'S. Snead', score: 'E', hl: false },
        { pos: '4T', name: 'G. Player', score: 'E', hl: false },
      ]

  const sc = (s: string) => s.startsWith('-') ? 'oklch(0.50 0.20 25)' : s === 'E' ? 'oklch(0.17 0.03 250)' : 'oklch(0.50 0.02 250)'

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'oklch(0.985 0.002 250)' }}>
      <div className="grid grid-cols-[32px_1fr_40px] text-[9px] uppercase tracking-wider font-semibold text-white px-3 py-2"
           style={{ background: 'oklch(0.30 0.08 255)', borderBottom: '2px solid oklch(0.72 0.11 78)' }}>
        <span className="text-center">Pos</span><span>Player</span><span className="text-center">Tot</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.name} className="grid grid-cols-[32px_1fr_40px] items-center px-3 py-2 text-xs transition-all duration-700"
          style={{ background: r.hl ? 'oklch(0.50 0.20 25 / 0.06)' : i % 2 === 1 ? 'oklch(0.97 0.003 95)' : 'white', borderBottom: '1px solid oklch(0.88 0.01 140)' }}>
          <span className="text-center font-bold" style={{ color: 'oklch(0.30 0.08 255)' }}>{r.pos}</span>
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${r.hl ? 'ring-1 ring-amber-400/50' : ''}`}
                 style={{ background: 'oklch(0.30 0.08 255)' }}>{r.name.split(' ').map(n => n[0]).join('')}</div>
            <span className={`truncate ${r.hl ? 'font-semibold' : ''}`} style={{ color: 'oklch(0.17 0.03 250)' }}>{r.name}</span>
          </div>
          <span className="text-center font-bold font-mono" style={{ color: sc(r.score) }}>{r.score}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Live Scoring with animated stepper ────────────── */
function ScoringVisual() {
  const [strokes, setStrokes] = useState(4)
  const [tapping, setTapping] = useState(false)
  useEffect(() => {
    const seq = () => {
      setTimeout(() => setTapping(true), 2000)
      setTimeout(() => { setStrokes(3); setTapping(false) }, 2300)
      setTimeout(() => setTapping(true), 5000)
      setTimeout(() => { setStrokes(4); setTapping(false) }, 5300)
    }
    seq(); const i = setInterval(seq, 7000)
    return () => clearInterval(i)
  }, [])

  const diff = strokes - 4
  const badge = diff < 0 ? { label: 'Birdie', bg: 'oklch(0.50 0.20 25 / 0.2)', color: 'oklch(0.50 0.20 25)' }
    : diff === 0 ? { label: 'Par', bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }
    : { label: 'Bogey', bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }

  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: 'oklch(0.28 0.07 255)' }}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold font-heading text-white">Hole 7</span>
          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all duration-300" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
        </div>
        <span className="text-lg font-bold text-white">{diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}</span>
      </div>
      <div className="h-px bg-white/10" />
      <div className="flex items-center justify-center gap-6 py-6">
        <div className={`w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white text-lg font-bold transition-transform duration-150 ${tapping ? 'scale-90 bg-white/25' : ''}`}>−</div>
        <span className="text-5xl font-heading font-bold text-white tabular-nums">{strokes}</span>
        <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white text-lg font-bold">+</div>
      </div>
      <div className="px-4 pb-3 space-y-1.5">
        {[{ label: 'Fairway Hit', on: true }, { label: 'Green in Reg', on: strokes <= 4 }].map(s => (
          <div key={s.label} className="flex items-center justify-between py-1">
            <span className="text-xs font-semibold text-white/70">{s.label}</span>
            <div className={`w-8 h-4 rounded-full relative transition-all duration-300 ${s.on ? '' : 'bg-white/15'}`}
                 style={s.on ? { background: 'oklch(0.72 0.11 78)' } : {}}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-300 ${s.on ? 'left-[16px]' : 'left-0.5'}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 pb-3">
        {['bg-red-500','bg-red-500','bg-white/25','bg-white/25','bg-gray-700','bg-white/25','ring-1 ring-accent','border border-white/30','border border-white/30'].map((c, i) => (
          <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${c}`}>{i+1}</div>
        ))}
      </div>
    </div>
  )
}

/* ── Powerup hand ──────────────────────────────────── */
function PowerupsVisual() {
  const cards = [
    { name: 'Fairway Finder', type: 'BOOST' as const, icon: '🌲', dur: '3 Holes' },
    { name: 'The Sandman', type: 'ATTACK' as const, icon: '⛏️', dur: '1 Hole' },
    { name: 'Stroke Swap', type: 'ATTACK' as const, icon: '⚔️', dur: '1 Stroke' },
    { name: 'Go For Glory', type: 'BOOST' as const, icon: '🏆', dur: '1 Hole · 2×' },
    { name: 'Happy Gilmore', type: 'BOOST' as const, icon: '😄', dur: '3 Holes' },
  ]
  const spread = Math.min(cards.length * 7, 35)
  return (
    <div className="relative flex items-end justify-center" style={{ height: '200px' }}>
      {cards.map((c, i) => {
        const isB = c.type === 'BOOST'
        const angle = -spread / 2 + (i / (cards.length - 1)) * spread
        const yOff = Math.abs(i - (cards.length - 1) / 2) * 6
        return (
          <div key={i} className="absolute rounded-2xl border-[3px] shadow-md flex flex-col overflow-hidden select-none hover:!-translate-y-5 hover:!rotate-0 hover:z-50 hover:shadow-xl transition-all duration-300"
            style={{
              width: '100px', height: '148px', background: '#f5f0e8',
              borderColor: isB ? 'rgb(6, 95, 70)' : 'rgb(185, 28, 28)',
              left: `calc(50% + ${(i - (cards.length - 1) / 2) * 28}px - 50px)`,
              bottom: `${yOff}px`, transform: `rotate(${angle}deg)`, transformOrigin: 'bottom center', zIndex: i + 1,
              animation: `heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.2 + i * 0.08}s both`,
            }}>
            <div className="flex items-start justify-between px-2 pt-2">
              <span className="text-base">{c.icon}</span>
              <span className={`text-[6px] font-bold uppercase tracking-widest mt-0.5 ${isB ? 'text-emerald-800' : 'text-red-700'}`}>{c.type}</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-2">
              <div className={`w-full border-t border-b py-1.5 ${isB ? 'border-emerald-800/25' : 'border-red-700/25'}`}>
                <p className={`font-heading font-bold text-center leading-tight text-[9px] ${isB ? 'text-emerald-900' : 'text-red-800'}`}>{c.name}</p>
              </div>
              <span className={`mt-0.5 text-[7px] font-semibold ${isB ? 'text-emerald-700/60' : 'text-red-600/60'}`}>{c.dur}</span>
            </div>
            <div className="flex items-end justify-between px-2 pb-2">
              <span className={`text-[6px] font-bold uppercase tracking-widest ${isB ? 'text-emerald-800' : 'text-red-700'}`}>{c.type}</span>
              <span className="text-base rotate-180">{c.icon}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Custom Branding ───────────────────────────────── */
function BrandingVisual() {
  const t = [
    { name: 'The Masters Cup', primary: 'oklch(0.30 0.08 255)', accent: 'oklch(0.72 0.11 78)', initials: 'MC', date: 'May 10–12', pl: '24' },
    { name: 'Sunset Scramble', primary: 'oklch(0.35 0.12 25)', accent: 'oklch(0.78 0.11 55)', initials: 'SS', date: 'Jun 1', pl: '16' },
    { name: 'Pine Valley Open', primary: 'oklch(0.25 0.10 150)', accent: 'oklch(0.65 0.14 160)', initials: 'PV', date: 'Jul 15–16', pl: '48' },
  ]
  return (
    <div className="space-y-3">
      {t.map((x, i) => (
        <div key={i} className="rounded-xl overflow-hidden shadow-md" style={{ animation: `heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.12}s both` }}>
          <div className="relative px-4 py-3 flex flex-col items-center text-center" style={{ background: x.primary }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-heading font-bold text-white/90"
                 style={{ border: `2px solid color-mix(in oklch, ${x.primary}, white 30%)`, boxShadow: '0 4px 16px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.2)', background: `linear-gradient(160deg, color-mix(in oklch, ${x.primary}, white 10%), color-mix(in oklch, ${x.primary}, black 8%))` }}>
              {x.initials}
            </div>
            <h4 className="text-sm font-heading font-bold text-white mt-2">{x.name}</h4>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[9px] text-white/50">{x.date} · {x.pl} players</span>
              <span className="inline-flex items-center gap-0.5 text-[8px] text-white font-bold uppercase bg-white/15 rounded-full px-1.5 py-0.5">
                <span className="h-1 w-1 rounded-full bg-green-400 animate-pulse" />Live
              </span>
            </div>
            <div className="w-10 h-0.5 rounded-full mt-2" style={{ background: x.accent }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Stats grid ────────────────────────────────────── */
function StatsVisual() {
  const stats = [
    { label: 'Scoring Avg', value: '+2.4' }, { label: 'Fairways', value: '64%', accent: true },
    { label: 'GIR', value: '44%' }, { label: 'Putts/Rnd', value: '31.2' },
    { label: 'Best Round', value: '72', accent: true }, { label: 'Rounds', value: '18' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
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

/* ── Chat mockup ───────────────────────────────────── */
function ChatVisual() {
  const msgs = [
    { name: 'JP', text: 'Just birdied 7! 🔥', right: false },
    { name: 'TW', text: 'Nice one. Using my mulligan on 9', right: true },
    { name: 'BH', text: 'Someone activated Stroke Swap on me 😤', right: false },
    { name: 'SS', text: 'Lol get rekt', right: true },
  ]
  return (
    <div className="space-y-2">
      {msgs.map((m, i) => (
        <div key={i} className={`flex ${m.right ? 'justify-end' : 'justify-start'}`}
          style={{ animation: `heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.4 + i * 0.12}s both` }}>
          <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.right ? 'bg-accent/20 rounded-br-sm' : 'bg-white/8 rounded-bl-sm'}`}>
            <span className="text-[9px] font-bold text-white/50 block">{m.name}</span>
            <span className="text-xs text-white/80">{m.text}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Notifications ─────────────────────────────────── */
function NotificationsVisual() {
  const notifs = [
    { text: 'T. Watson scored a birdie on Hole 7', time: '2m ago', type: 'score' },
    { text: 'Mulligan activated by B. Hogan', time: '5m ago', type: 'powerup' },
    { text: 'New player registered: S. Snead', time: '12m ago', type: 'player' },
  ]
  return (
    <div className="space-y-2">
      {notifs.map((n, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg bg-white/5 border border-white/8 px-3 py-2.5"
          style={{ animation: `heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.1}s both` }}>
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'score' ? 'bg-red-500' : n.type === 'powerup' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
          <div className="min-w-0">
            <p className="text-xs text-white/80">{n.text}</p>
            <p className="text-[9px] text-white/30 mt-0.5">{n.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── GPS Map mockup ────────────────────────────────── */
function GPSVisual() {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: 'oklch(0.35 0.08 150)' }}>
      <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'oklch(0.30 0.08 255)' }}>
        <span className="text-[10px] font-bold text-white/80">Hole 4 · Par 5 · 520 yds</span>
        <span className="text-[9px] text-accent font-bold">GPS</span>
      </div>
      <div className="relative p-4 flex items-center justify-center" style={{ height: '140px' }}>
        {/* Fairway shape */}
        <div className="absolute inset-4 rounded-full opacity-30" style={{ background: 'radial-gradient(ellipse 40% 80% at 50% 50%, oklch(0.55 0.15 145), transparent)' }} />
        {/* Distances */}
        {[{ label: '250', top: '20%', left: '30%' }, { label: '180', top: '45%', left: '55%' }, { label: '95', top: '70%', left: '45%' }].map((d, i) => (
          <div key={i} className="absolute flex flex-col items-center" style={{ top: d.top, left: d.left, animation: `heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.4 + i * 0.15}s both` }}>
            <div className="w-3 h-3 rounded-full border-2 border-white/60 bg-white/20" />
            <span className="text-[10px] font-bold text-white mt-0.5">{d.label}</span>
            <span className="text-[7px] text-white/40">yds</span>
          </div>
        ))}
        {/* Flag */}
        <div className="absolute" style={{ top: '15%', right: '30%', animation: 'heroFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.8s both' }}>
          <span className="text-lg">⛳</span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   FEATURE SECTIONS
   ═══════════════════════════════════════════════════════ */

interface FeatureSection {
  title: string
  description: string
  visual: ReactNode
  icon: typeof BarChart3
}

const CORE_FEATURES: FeatureSection[] = [
  { icon: BarChart3, title: 'Live Leaderboards', description: 'Real-time scoring updates that keep every player connected. Watch positions change hole by hole with masters-style leaderboards — birdie red, bogey gray, tied positions, and live pulse indicators.', visual: <LeaderboardVisual /> },
  { icon: ClipboardList, title: 'Live Scoring', description: 'Score from your phone with the stepper interface. Tap for strokes and putts, toggle fairway hits and greens in regulation. Color-coded hole navigation shows birdies, pars, and bogeys at a glance.', visual: <ScoringVisual /> },
  { icon: Zap, title: 'Powerup Draft', description: 'A fantasy-golf twist. Before each round, players draft powerup cards from a shared pool. Boost cards help your game — mulligans, double downs. Attack cards target opponents — stroke swaps, pressure plays.', visual: <PowerupsVisual /> },
]

const MORE_FEATURES: FeatureSection[] = [
  { icon: Palette, title: 'Custom Branding', description: 'Choose primary and accent colors, upload a logo, and watch it come to life across embossed badges, tournament headers, and the full player experience.', visual: <BrandingVisual /> },
  { icon: TrendingUp, title: 'Stats & Insights', description: 'Scoring averages, fairway percentages, GIR, putting stats, and round-over-round trends — all calculated automatically from your scorecard data.', visual: <StatsVisual /> },
  { icon: MessageSquare, title: 'Tournament Chat', description: 'Built-in group chat keeps the banter going. React to scores, trash talk powerup plays, and celebrate birdies in real time.', visual: <ChatVisual /> },
  { icon: Bell, title: 'Real-Time Notifications', description: 'Instant alerts for scores, draft picks, powerup activations, and tournament updates. Never miss a leaderboard shake-up.', visual: <NotificationsVisual /> },
  { icon: Map, title: 'GPS & Yardages', description: 'Interactive course maps with distances to pin, hazards, and layup targets. Know your yardage before you pull a club.', visual: <GPSVisual /> },
]

const GRID_FEATURES = [
  { icon: Users, title: 'Player Registration', desc: 'Share a join code or open public registration. Players set handicaps and join in seconds.' },
  { icon: Trophy, title: 'Multiple Formats', desc: 'Stroke play, match play, scrambles — with configurable round counts and tee selections.' },
  { icon: Shield, title: 'Handicap Systems', desc: 'WHS, Stableford, Callaway, and Peoria — automatic calculation, zero manual math.' },
  { icon: Repeat, title: 'Seasons & Leagues', desc: 'Link tournaments into a season with cumulative standings and recurring rosters.' },
  { icon: Camera, title: 'Photo Gallery', desc: 'Players upload course photos to the shared tournament gallery.' },
  { icon: Smartphone, title: 'Mobile-First', desc: 'Designed for on-course use. Score with one hand, check the leaderboard between holes.' },
  { icon: Settings, title: 'Admin Controls', desc: 'Full admin dashboard for managing scores, players, draft orders, and settings.' },
  { icon: Globe, title: 'Public Tournaments', desc: 'Open your tournament to the public. Players nearby can discover and join.' },
  { icon: Timer, title: 'Registration Deadlines', desc: 'Set cutoffs for registration. Invite-only, open, or deadline-based.' },
  { icon: Crosshair, title: 'Flight Management', desc: 'Organize players into flights by handicap, skill, or custom groupings.' },
]

function FeatureRow({ feature, reverse, delay }: { feature: FeatureSection; reverse?: boolean; delay?: number }) {
  return (
    <ScrollReveal direction="up" delay={delay ?? 0}>
      <div className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-6 sm:gap-8 lg:gap-14 items-center`}>
        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <feature.icon className="w-4 sm:w-5 h-4 sm:h-5 text-accent" />
            <h3 className="font-heading text-lg sm:text-xl lg:text-2xl font-bold text-white">{feature.title}</h3>
          </div>
          <p className="text-white/50 text-sm sm:text-base leading-relaxed">{feature.description}</p>
        </div>
        {/* Visual */}
        <div className="w-full max-w-[320px] sm:max-w-none lg:w-[340px] shrink-0 mx-auto lg:mx-0">
          {feature.visual}
        </div>
      </div>
    </ScrollReveal>
  )
}

export function FeaturesContent() {
  return (
    <>
      {/* Core features — alternating layout */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-20 space-y-12 sm:space-y-16 lg:space-y-20">
        {CORE_FEATURES.map((f, i) => (
          <FeatureRow key={f.title} feature={f} reverse={i % 2 === 1} delay={i * 100} />
        ))}
      </section>

      {/* More features — alternating layout */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 sm:pb-16 lg:pb-20 space-y-10 sm:space-y-14 lg:space-y-16">
        <ScrollReveal direction="up">
          <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-bold text-white">
            And <span className="text-accent">so much</span> more
          </h2>
        </ScrollReveal>

        {MORE_FEATURES.map((f, i) => (
          <FeatureRow key={f.title} feature={f} reverse={i % 2 === 0} delay={0} />
        ))}
      </section>

      {/* Grid features — compact cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 sm:pb-16 lg:pb-24">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
          {GRID_FEATURES.map((f, i) => (
            <ScrollReveal key={f.title} direction="up" delay={i * 50} className="h-full">
              <div className="h-full rounded-xl border border-white/8 bg-white/[0.02] p-3 sm:p-5 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.04]">
                <f.icon className="w-4 sm:w-5 h-4 sm:h-5 text-white/30 mb-2 sm:mb-3" />
                <h3 className="font-heading font-bold text-xs sm:text-sm text-white mb-0.5 sm:mb-1">{f.title}</h3>
                <p className="text-white/40 text-[10px] sm:text-xs leading-relaxed">{f.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>
    </>
  )
}
