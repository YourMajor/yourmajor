'use client'

import type { ReactNode } from 'react'
import type { Timeline } from 'animejs'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useTimelineInView } from '@/components/motion/useTimelineInView'
import {
  BarChart3, ClipboardList, Users, Camera, Shield,
  MessageSquare, TrendingUp, Map, Smartphone, Settings,
  Repeat, Timer, Globe, Crosshair, Palette, Trophy,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════
   VISUALS

   Everything here is the product's own furniture rendered natively, on the
   marketing token scope. No raw palette values: see DESIGN.md. The one
   deliberate exception is BrandingVisual, where arbitrary colour is the
   feature being demonstrated.

   Player names and figures are a DEMONSTRATION, not records.
   ═══════════════════════════════════════════════════════ */

/* Steps down on narrow phones for the same reason LeaderboardPlate's do: fixed
   data columns set the min-content width of everything around them. */
const BOARD_COLS =
  'grid grid-cols-[2.25rem_1fr_2.5rem_2.25rem_2.5rem] sm:grid-cols-[2.5rem_1fr_3.25rem_2.75rem_3.25rem] px-3 sm:px-4'
const LABEL = 'text-[0.6875rem] font-semibold uppercase tracking-[0.14em]'

/* ── The board, net of handicap ────────────────────────
   Deliberately a different lens on the same event as the hero's
   LeaderboardPlate: gross order there is Watson, Palmer, Hogan, Snead,
   Player. Net of handicap it inverts, which is the whole point of scoring a
   group where nobody carries an official index. */
const NET_ROWS = [
  { pos: '1', name: 'S. Snead', gross: '78', hcp: '14', net: '64' },
  { pos: '2', name: 'G. Player', gross: '81', hcp: '16', net: '65' },
  { pos: '3', name: 'T. Watson', gross: '71', hcp: '4', net: '67' },
  { pos: 'T4', name: 'J. Palmer', gross: '72', hcp: '4', net: '68' },
  { pos: 'T4', name: 'B. Hogan', gross: '75', hcp: '7', net: '68' },
]

function NetBoardVisual() {
  return (
    <div className="mk-plate overflow-hidden">
      <div
        className={`${BOARD_COLS} items-center py-3`}
        style={{
          backgroundColor: 'var(--mk-green-deep)',
          borderBottom: '2px solid var(--mk-gold)',
        }}
      >
        {['Pos', 'Player', 'Gross', 'Hcp', 'Net'].map((label, i) => (
          <span
            key={label}
            className={`${LABEL} ${i === 1 ? 'text-left' : 'text-center'}`}
            style={{ color: 'var(--mk-gold)' }}
          >
            {label}
          </span>
        ))}
      </div>

      {NET_ROWS.map((row, i) => (
        <div
          key={row.name}
          className={`${BOARD_COLS} items-center py-3`}
          style={{
            borderBottom: '1px solid var(--mk-rule-ink)',
            borderLeft: i === 0 ? '2px solid var(--mk-gold)' : '2px solid transparent',
          }}
        >
          <span className="mk-data text-center text-sm" style={{ color: 'var(--mk-ink)' }}>
            {row.pos}
          </span>
          <span className="truncate text-sm font-medium" style={{ color: 'var(--mk-ink)' }}>
            {row.name}
          </span>
          <span className="mk-data text-center text-sm" style={{ color: 'var(--mk-over-par)' }}>
            {row.gross}
          </span>
          <span className="mk-data text-center text-sm" style={{ color: 'var(--mk-over-par)' }}>
            {row.hcp}
          </span>
          <span className="mk-data text-center text-base" style={{ color: 'var(--mk-ink)' }}>
            {row.net}
          </span>
        </div>
      ))}

      <p className="px-4 py-3 text-xs" style={{ color: 'var(--mk-over-par)' }}>
        Example board, net of handicap
      </p>
    </div>
  )
}

/* ── Live scoring ──────────────────────────────────────
   The rest state below is the readable one: hole 7, par, four strokes. The
   timeline moves it to a birdie and back. If the timeline never runs, the
   plate still says everything it needs to. */

function paintHole(root: HTMLElement, strokes: number) {
  const under = strokes < 4
  const q = (sel: string) => root.querySelector<HTMLElement>(sel)

  const count = q('[data-strokes]')
  if (count) count.textContent = String(strokes)

  const badge = q('[data-badge]')
  if (badge) {
    badge.textContent = under ? 'Birdie' : 'Par'
    badge.style.color = under ? 'var(--mk-under-par)' : 'var(--mk-over-par)'
    badge.style.borderColor = under ? 'var(--mk-under-par)' : 'var(--mk-rule-ink)'
  }

  const total = q('[data-total]')
  if (total) {
    total.textContent = under ? '-1' : 'E'
    total.style.color = under ? 'var(--mk-under-par)' : 'var(--mk-ink)'
  }
}

function buildScoringTimeline(tl: Timeline, root: HTMLElement) {
  const count = root.querySelector<HTMLElement>('[data-strokes]')
  const badge = root.querySelector<HTMLElement>('[data-badge]')
  const minus = root.querySelector<HTMLElement>('[data-step="minus"]')
  const plus = root.querySelector<HTMLElement>('[data-step="plus"]')
  if (!count || !badge || !minus || !plus) return

  // Hole played in one under.
  tl.add(minus, { scale: 0.88, duration: 110, ease: 'outQuad' }, 1600)
    .add(minus, { scale: 1, duration: 200, ease: 'outCubic' }, 1710)
    .call(() => paintHole(root, 3), 1720)
    .add(count, { scale: 1.16, duration: 120, ease: 'outQuad' }, 1720)
    .add(count, { scale: 1, duration: 260, ease: 'outCubic' }, 1840)
    .add(badge, { opacity: [0, 1], y: [5, 0], duration: 280, ease: 'outCubic' }, 1720)

  // And back, so the loop reads as a stroke being corrected rather than a
  // score inventing itself.
  tl.add(plus, { scale: 0.88, duration: 110, ease: 'outQuad' }, 4400)
    .add(plus, { scale: 1, duration: 200, ease: 'outCubic' }, 4510)
    .call(() => paintHole(root, 4), 4520)
    .add(count, { scale: 1.16, duration: 120, ease: 'outQuad' }, 4520)
    .add(count, { scale: 1, duration: 260, ease: 'outCubic' }, 4640)
    .add(badge, { opacity: [0, 1], y: [5, 0], duration: 280, ease: 'outCubic' }, 4520)
    .set(count, { scale: 1 }, 6600)
}

function ScoringVisual() {
  const ref = useTimelineInView<HTMLDivElement>(buildScoringTimeline)

  return (
    <div ref={ref} className="mk-plate overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: 'var(--mk-green-deep)',
          borderBottom: '2px solid var(--mk-gold)',
        }}
      >
        <span className={LABEL} style={{ color: 'var(--mk-gold)' }}>
          Hole 7 · Par 4
        </span>
        <span className="mk-data text-sm" style={{ color: 'var(--mk-bone)' }}>
          Round 2
        </span>
      </div>

      <div className="flex items-center justify-center gap-7 px-4 py-7">
        <span
          data-step="minus"
          aria-hidden
          className="flex h-11 w-11 items-center justify-center text-xl font-semibold"
          style={{
            border: '1px solid var(--mk-rule-ink)',
            borderRadius: 'var(--mk-radius-md)',
            color: 'var(--mk-ink)',
          }}
        >
          −
        </span>
        <span
          data-strokes
          className="mk-data inline-block text-5xl"
          style={{ color: 'var(--mk-ink)' }}
        >
          4
        </span>
        <span
          data-step="plus"
          aria-hidden
          className="flex h-11 w-11 items-center justify-center text-xl font-semibold"
          style={{
            border: '1px solid var(--mk-rule-ink)',
            borderRadius: 'var(--mk-radius-md)',
            color: 'var(--mk-ink)',
          }}
        >
          +
        </span>
      </div>

      <div className="flex items-center justify-center gap-3 pb-6">
        <span
          data-badge
          className={`${LABEL} inline-block px-2.5 py-1`}
          style={{
            border: '1px solid var(--mk-rule-ink)',
            borderRadius: 'var(--mk-radius-sm)',
            color: 'var(--mk-over-par)',
          }}
        >
          Par
        </span>
        <span data-total className="mk-data text-base" style={{ color: 'var(--mk-ink)' }}>
          E
        </span>
      </div>

      {[
        { label: 'Fairway hit', value: 'Yes' },
        { label: 'Green in regulation', value: 'Yes' },
        { label: 'Putts', value: '2' },
      ].map((stat) => (
        <div
          key={stat.label}
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid var(--mk-rule-ink)' }}
        >
          <span className="text-sm" style={{ color: 'var(--mk-over-par)' }}>
            {stat.label}
          </span>
          <span className="mk-data text-sm" style={{ color: 'var(--mk-ink)' }}>
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Custom branding ───────────────────────────────────
   Deliberate token exception: arbitrary per-tournament colour is the feature.
   Only the frame, type and radii answer to the marketing scope. */
function BrandingVisual() {
  const tournaments = [
    { name: 'The Masters Cup', primary: 'oklch(0.30 0.08 255)', accent: 'oklch(0.72 0.11 78)', initials: 'MC', meta: 'May 10 to 12 · 24 players' },
    { name: 'Sunset Scramble', primary: 'oklch(0.35 0.12 25)', accent: 'oklch(0.78 0.11 55)', initials: 'SS', meta: 'Jun 1 · 16 players' },
    { name: 'Pine Valley Open', primary: 'oklch(0.25 0.10 150)', accent: 'oklch(0.65 0.14 160)', initials: 'PV', meta: 'Jul 15 to 16 · 48 players' },
  ]

  return (
    <div className="space-y-3">
      {tournaments.map((t) => (
        <div
          key={t.name}
          className="flex items-center gap-3 px-4 py-3"
          style={{ background: t.primary, borderRadius: 'var(--mk-radius-md)' }}
        >
          <span
            className="mk-data flex h-11 w-11 shrink-0 items-center justify-center text-xs text-white"
            style={{
              borderRadius: '50%',
              border: `1px solid color-mix(in oklch, ${t.primary}, white 30%)`,
              background: `color-mix(in oklch, ${t.primary}, white 8%)`,
            }}
          >
            {t.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{t.name}</span>
            <span className="block truncate text-xs text-white/70">{t.meta}</span>
          </span>
          <span className="h-8 w-1 shrink-0" style={{ background: t.accent }} />
        </div>
      ))}
    </div>
  )
}

/* ── Stats ─────────────────────────────────────────────
   A hairline-ruled figure table, not six boxes. */
function StatsVisual() {
  const stats = [
    { label: 'Scoring average', value: '+2.4' },
    { label: 'Fairways hit', value: '64%' },
    { label: 'Greens in regulation', value: '44%' },
    { label: 'Putts per round', value: '31.2' },
    { label: 'Best round', value: '72' },
    { label: 'Rounds played', value: '18' },
  ]

  return (
    <div>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-baseline justify-between py-2.5"
          style={{ borderBottom: '1px solid var(--mk-rule-light)' }}
        >
          <span className="text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
            {stat.label}
          </span>
          <span className="mk-data text-lg" style={{ color: 'var(--mk-text)' }}>
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Tournament chat ───────────────────────────────────── */
function ChatVisual() {
  const messages = [
    { name: 'J. Palmer', text: 'Just birdied 7.', mine: false },
    { name: 'T. Watson', text: 'Nice. Using my mulligan on 9.', mine: true },
    { name: 'B. Hogan', text: 'Someone just played Stroke Swap on me.', mine: false },
    { name: 'S. Snead', text: 'That was me. No notes.', mine: true },
  ]

  return (
    <div className="space-y-2.5">
      {messages.map((message) => (
        <div key={message.text} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
          <div
            className="max-w-[85%] px-3 py-2"
            style={{
              borderRadius: 'var(--mk-radius-md)',
              background: message.mine ? 'var(--mk-bone)' : 'var(--mk-green-raised)',
              border: message.mine ? 'none' : '1px solid var(--mk-rule-light)',
              color: message.mine ? 'var(--mk-ink)' : 'var(--mk-text)',
            }}
          >
            <span
              className={`${LABEL} block`}
              style={{ color: message.mine ? 'var(--mk-over-par)' : 'var(--mk-text-subtle)' }}
            >
              {message.name}
            </span>
            <span className="mt-0.5 block text-sm">{message.text}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── GPS yardages ──────────────────────────────────────── */
function GPSVisual() {
  const greens = [
    { label: 'Front', value: '258' },
    { label: 'Middle', value: '275' },
    { label: 'Back', value: '290' },
  ]

  return (
    <div>
      <div
        className="flex items-center justify-between pb-2.5"
        style={{ borderBottom: '2px solid var(--mk-gold)' }}
      >
        <span className={LABEL} style={{ color: 'var(--mk-gold)' }}>
          Hole 4 · Par 5
        </span>
      </div>
      {greens.map((green) => (
        <div
          key={green.label}
          className="flex items-baseline justify-between py-3"
          style={{ borderBottom: '1px solid var(--mk-rule-light)' }}
        >
          <span className="text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
            {green.label}
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="mk-data text-2xl" style={{ color: 'var(--mk-text)' }}>
              {green.value}
            </span>
            <span className={LABEL} style={{ color: 'var(--mk-text-subtle)' }}>
              yds
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   COMPOSITION

   Two image/text splits, then the run breaks: a full-width band, a bento, and
   a ruled list. Nothing alternates more than twice in a row.
   ═══════════════════════════════════════════════════════ */

const SPLIT_FEATURES = [
  {
    icon: BarChart3,
    title: 'Gross and net, side by side',
    description:
      'Every board reads both ways at once. Scratch players see gross, everyone else sees net, and a group where nobody carries an official index still gets a result it can argue about honestly.',
    visual: <NetBoardVisual />,
  },
  {
    icon: ClipboardList,
    title: 'Scoring from the tee box',
    description:
      'Tap strokes and putts, flag fairways and greens in regulation. It is built for one hand, bright sun and patchy signal, because that is where scoring actually happens.',
    visual: <ScoringVisual />,
  },
]

const BENTO_FEATURES = [
  {
    icon: Palette,
    title: 'Custom branding',
    description:
      'Set primary and accent colours, upload a logo, and it carries through embossed badges, headers and the full player experience.',
    visual: <BrandingVisual />,
  },
  {
    icon: TrendingUp,
    title: 'Stats and insights',
    description:
      'Scoring averages, fairways, greens in regulation and putting, calculated from scorecard data rather than entered by hand.',
    visual: <StatsVisual />,
  },
  {
    icon: MessageSquare,
    title: 'Tournament chat',
    description:
      'The group thread lives next to the leaderboard, so the banter and the scores are in the same place.',
    visual: <ChatVisual />,
  },
  {
    icon: Map,
    title: 'GPS and yardages',
    description:
      'Front, middle and back of every green. Pull the right club without opening a second app.',
    visual: <GPSVisual />,
  },
]

const LIST_FEATURES = [
  { icon: Users, title: 'Player registration', desc: 'Share a join code or open public registration.' },
  { icon: Trophy, title: 'Multiple formats', desc: 'Stroke play, match play and scrambles, over any number of rounds.' },
  { icon: Shield, title: 'Handicap systems', desc: 'WHS, Stableford, Callaway and Peoria, calculated automatically.' },
  { icon: Repeat, title: 'Seasons and leagues', desc: 'Link events into a season with cumulative standings.' },
  { icon: Camera, title: 'Photo gallery', desc: 'A shared course gallery every player can post to.' },
  { icon: Smartphone, title: 'Mobile first', desc: 'Score with one hand, check the board between holes.' },
  { icon: Settings, title: 'Admin controls', desc: 'Manage scores, players, draft order and settings from one dashboard.' },
  { icon: Globe, title: 'Public tournaments', desc: 'Open the event so players nearby can find and join it.' },
  { icon: Timer, title: 'Registration deadlines', desc: 'Invite only, open, or closed on a date you set.' },
  { icon: Crosshair, title: 'Flight management', desc: 'Group players by handicap, skill or your own grouping.' },
]

type SplitFeature = {
  icon: typeof BarChart3
  title: string
  description: string
  visual: ReactNode
}

function FeatureSplit({ feature, reverse }: { feature: SplitFeature; reverse?: boolean }) {
  return (
    <ScrollReveal direction="up" duration={600}>
      <div
        className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-10 lg:gap-16`}
      >
        <div className="min-w-0 flex-1">
          <feature.icon className="h-5 w-5" style={{ color: 'var(--mk-gold)' }} aria-hidden />
          <h3 className="mt-4 text-2xl lg:text-3xl">{feature.title}</h3>
          <p
            className="mt-4 max-w-[52ch] text-base leading-relaxed"
            style={{ color: 'var(--mk-text-muted)' }}
          >
            {feature.description}
          </p>
        </div>
        <div className="w-full shrink-0 lg:w-[24rem]">{feature.visual}</div>
      </div>
    </ScrollReveal>
  )
}

/** The two image/text splits that open the features narrative. */
export function FeatureSplits() {
  return (
    <div className="mk-container space-y-24 lg:space-y-32">
      {SPLIT_FEATURES.map((feature, i) => (
        <FeatureSplit key={feature.title} feature={feature} reverse={i % 2 === 1} />
      ))}
    </div>
  )
}

/** Bento. Four capabilities under gold hairlines, no cards, nothing nested. */
export function FeatureBento() {
  return (
    <div className="mk-container mt-24 lg:mt-32">
      <div className="grid gap-x-16 gap-y-20 lg:grid-cols-2">
          {BENTO_FEATURES.map((feature, i) => (
            <ScrollReveal key={feature.title} direction="up" delay={i * 60} duration={600}>
              <div style={{ borderTop: '1px solid var(--mk-rule-gold)' }} className="pt-6">
                <feature.icon className="h-5 w-5" style={{ color: 'var(--mk-gold)' }} aria-hidden />
                <h3 className="mt-4 text-xl lg:text-2xl">{feature.title}</h3>
                <p
                  className="mt-3 max-w-[48ch] text-sm leading-relaxed"
                  style={{ color: 'var(--mk-text-muted)' }}
                >
                  {feature.description}
                </p>
                <div className="mt-7">{feature.visual}</div>
              </div>
            </ScrollReveal>
          ))}
      </div>
    </div>
  )
}

/** Ruled list. Ten capabilities that need naming, not illustrating. */
export function FeatureList() {
  return (
    <div className="mk-container mt-24 lg:mt-32">
      <h3 className="text-2xl lg:text-3xl">Also included</h3>
      <div className="mt-10 grid gap-x-16 sm:grid-cols-2">
        {LIST_FEATURES.map((feature, i) => (
          <ScrollReveal key={feature.title} direction="up" delay={i * 30} duration={500}>
            <div
              className="flex items-start gap-4 py-5"
              style={{ borderTop: '1px solid var(--mk-rule-light)' }}
            >
              <feature.icon
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: 'var(--mk-gold)' }}
                aria-hidden
              />
              <div className="min-w-0">
                <span className="block text-base font-semibold" style={{ color: 'var(--mk-text)' }}>
                  {feature.title}
                </span>
                <span
                  className="mt-1 block text-sm leading-relaxed"
                  style={{ color: 'var(--mk-text-subtle)' }}
                >
                  {feature.desc}
                </span>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  )
}
