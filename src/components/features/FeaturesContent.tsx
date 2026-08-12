'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Timeline } from 'animejs'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useTimelineInView } from '@/components/motion/useTimelineInView'
import {
  BarChart3, ClipboardList, Users, Camera, Shield,
  MessageSquare, TrendingUp, Map as MapIcon, Smartphone, Settings,
  Repeat, Timer, Globe, Crosshair, Palette, Trophy,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)

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
const LABEL = 'mk-label'

/* ── The board, gross and net ──────────────────────────
   Deliberately a different lens on the same event as the hero's
   LeaderboardPlate. Net of handicap the running order inverts, which is the
   whole point of scoring a group where nobody carries an official index,
   and the toggle demonstrates it live: rows FLIP to their new positions by
   hand (WAAPI + measured tops), because layout animation on table-shaped
   rows is unreliable. */
const BOARD_PLAYERS = [
  { name: 'S. Snead', gross: 78, hcp: 14, net: 64 },
  { name: 'G. Player', gross: 81, hcp: 16, net: 65 },
  { name: 'T. Watson', gross: 71, hcp: 4, net: 67 },
  { name: 'J. Palmer', gross: 72, hcp: 4, net: 68 },
  { name: 'B. Hogan', gross: 75, hcp: 7, net: 68 },
]

function boardOrder(view: 'net' | 'gross') {
  const sorted = [...BOARD_PLAYERS].sort((a, b) => a[view] - b[view])
  return sorted.map((p) => {
    const tied = sorted.filter((q) => q[view] === p[view]).length > 1
    const rank = sorted.findIndex((q) => q[view] === p[view]) + 1
    return { ...p, pos: tied ? `T${rank}` : String(rank) }
  })
}

function NetBoardVisual() {
  const [view, setView] = useState<'net' | 'gross'>('net')
  const listRef = useRef<HTMLDivElement>(null)
  const prevTops = useRef<Map<string, number> | null>(null)
  const rows = boardOrder(view)

  const toggle = (next: 'net' | 'gross') => {
    if (next === view) return
    const list = listRef.current
    if (list) {
      const tops = new Map<string, number>()
      list.querySelectorAll<HTMLElement>('[data-board-row]').forEach((el) => {
        tops.set(el.dataset.boardRow!, el.getBoundingClientRect().top)
      })
      prevTops.current = tops
    }
    setView(next)
  }

  useLayoutEffect(() => {
    const tops = prevTops.current
    const list = listRef.current
    prevTops.current = null
    if (!tops || !list) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    list.querySelectorAll<HTMLElement>('[data-board-row]').forEach((el) => {
      const prev = tops.get(el.dataset.boardRow!)
      if (prev === undefined) return
      const delta = prev - el.getBoundingClientRect().top
      if (!delta) return
      el.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
        { duration: 480, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
    })
  }, [view])

  return (
    <div>
      <div
        className="mb-3 flex justify-end gap-1"
        role="tablist"
        aria-label="Board scoring view"
      >
        {(['gross', 'net'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => toggle(v)}
            className={`${LABEL} px-3 py-2 transition-colors pointer-coarse:min-h-11 pointer-coarse:px-4`}
            style={{
              color: view === v ? 'var(--mk-gold)' : 'var(--mk-text-subtle)',
              borderBottom: `2px solid ${view === v ? 'var(--mk-gold)' : 'transparent'}`,
            }}
          >
            {v}
          </button>
        ))}
      </div>

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
              {/* "Grs" below sm: the full word collided with Hcp at 390. */}
              {label === 'Gross' ? (
                <>
                  <span className="sm:hidden">Grs</span>
                  <span className="hidden sm:inline">Gross</span>
                </>
              ) : (
                label
              )}
            </span>
          ))}
        </div>

        <div ref={listRef}>
          {rows.map((row, i) => (
            <div
              key={row.name}
              data-board-row={row.name}
              className={`${BOARD_COLS} items-center py-3`}
              style={{
                borderBottom: '1px solid var(--mk-rule-ink)',
                borderLeft: i === 0 ? '2px solid var(--mk-gold)' : '2px solid transparent',
                backgroundColor: 'var(--mk-bone)',
              }}
            >
              <span className="mk-data text-center text-sm" style={{ color: 'var(--mk-ink)' }}>
                {row.pos}
              </span>
              <span className="truncate text-sm font-medium" style={{ color: 'var(--mk-ink)' }}>
                {row.name}
              </span>
              <span
                className="mk-data text-center text-sm"
                style={{
                  color: view === 'gross' ? 'var(--mk-ink)' : 'var(--mk-over-par)',
                  fontSize: view === 'gross' ? '1rem' : undefined,
                }}
              >
                {row.gross}
              </span>
              <span className="mk-data text-center text-sm" style={{ color: 'var(--mk-over-par)' }}>
                {row.hcp}
              </span>
              <span
                className="mk-data text-center"
                style={{
                  color: view === 'net' ? 'var(--mk-ink)' : 'var(--mk-over-par)',
                  fontSize: view === 'net' ? '1rem' : '0.875rem',
                }}
              >
                {row.net}
              </span>
            </div>
          ))}
        </div>

        <p className="px-4 py-3 text-xs" style={{ color: 'var(--mk-over-par)' }}>
          Example board. Flip it: the order changes with the lens.
        </p>
      </div>
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

      {/* The thread is alive: a pure-CSS typing indicator, additive only, so
          no message is ever gated behind it. Still under reduced motion. */}
      <div className="flex justify-start" aria-hidden>
        <div
          className="flex items-center gap-1.5 px-3 py-2.5"
          style={{
            borderRadius: 'var(--mk-radius-md)',
            background: 'var(--mk-green-raised)',
            border: '1px solid var(--mk-rule-light)',
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="mk-typing-dot h-1.5 w-1.5 rounded-full"
              style={{
                background: 'var(--mk-text-subtle)',
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>
      </div>
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
    icon: MapIcon,
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
          <h3 data-split-heading className="mt-4 text-2xl lg:text-3xl">
            {feature.title}
          </h3>
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

/** The two image/text splits that open the features narrative. Top padding
    gives the poster's photo fade room to finish before the first split. */
export function FeatureSplits() {
  const rootRef = useRef<HTMLDivElement>(null)

  // Each split's title rises out of a mask, line by line, as its row
  // arrives — the typographic beat of this stretch. Desktop full-motion
  // only: below the gate the headings are never split or transformed, so
  // the static rest state is the plain heading.
  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add(
        // Runs on phones too: transform/opacity only, no pin, no scroll
        // hijack. The pinned chapters and ScrollSmoother stay desktop-only.
        '(prefers-reduced-motion: no-preference)',
        () => {
          const splits = gsap.utils
            .toArray<HTMLElement>('[data-split-heading]', rootRef.current)
            .map((heading) =>
              SplitText.create(heading, {
                type: 'lines',
                mask: 'lines',
                // Re-splits when the webfont lands or the column resizes;
                // the animation is created inside onSplit so it always
                // targets the current lines.
                autoSplit: true,
                onSplit(self) {
                  return gsap.from(self.lines, {
                    yPercent: 110,
                    duration: 0.7,
                    ease: 'power3.out',
                    stagger: 0.1,
                    scrollTrigger: {
                      trigger: heading,
                      start: 'top 85%',
                      toggleActions: 'play none none reset',
                    },
                  })
                },
              }),
            )
          return () => splits.forEach((split) => split.revert())
        },
      )
      return () => media.revert()
    },
    { scope: rootRef },
  )

  return (
    <div ref={rootRef} className="mk-container pt-16 lg:pt-36">
      {/* The run's opener. Until now the only heading covering the whole
          features stretch was the poster's, several sections earlier — a
          visitor scrolling past mockups was never told what they were. */}
      <h2>How a round gets scored</h2>
      <p
        className="mt-4 max-w-[65ch] text-pretty text-base lg:text-lg"
        style={{ color: 'var(--mk-text-muted)' }}
      >
        Two boards, one round: what the group shot, and what it shot after
        handicaps.
      </p>

      <div className="mt-14 space-y-16 lg:mt-20 lg:space-y-32">
        {SPLIT_FEATURES.map((feature, i) => (
          <FeatureSplit key={feature.title} feature={feature} reverse={i % 2 === 1} />
        ))}
      </div>
    </div>
  )
}

/** Bento. Four capabilities under gold hairlines, no cards, nothing nested.
    No hover treatment: the pointer spotlight showed hard edges over the
    mockups and was removed at the user's direction. */
export function FeatureBento() {
  const rootRef = useRef<HTMLDivElement>(null)

  // Each capability's gold rule draws itself in as the row arrives.
  // ScrollTrigger, not `animation-timeline: view()`: ScrollSmoother
  // transforms the scrolled content and freezes CSS scroll-driven
  // animations at their first frame.
  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add(
        // Runs on phones too: transform/opacity only, no pin, no scroll
        // hijack. The pinned chapters and ScrollSmoother stay desktop-only.
        '(prefers-reduced-motion: no-preference)',
        () => {
          gsap.utils
            .toArray<HTMLElement>('.mk-hairline-draw', rootRef.current)
            .forEach((rule) => {
              gsap.fromTo(
                rule,
                { backgroundSize: '0% 1px' },
                {
                  backgroundSize: '100% 1px',
                  ease: 'none',
                  // Scrubbed, not toggled: a trigger that is already past
                  // its start when it is created never fires onEnter, and
                  // the rule sat at 0% forever.
                  scrollTrigger: {
                    trigger: rule,
                    start: 'top 92%',
                    end: 'top 62%',
                    scrub: 1,
                  },
                },
              )
            })
        },
      )
      return () => media.revert()
    },
    { scope: rootRef },
  )

  return (
    <div ref={rootRef} id="bento" className="mk-container mt-16 lg:mt-32">
      {/* Neither the heading nor the line below it claims what a tier
          includes. Both did: "Built into every tournament" over "no add-ons
          and no upgrade path, every event gets all of it" — and branding and
          chat are not on the free tier. What each tier carries is stated
          once, on /pricing, and nowhere else. */}
      <h2>More than a scoreboard</h2>
      {/* text-pretty: this line orphaned its last word on a narrow column.
          The wrap is the browser's job, so hand it the rule rather than
          hand-tuning a break that only holds at one width. */}
      <p
        className="mt-4 max-w-[65ch] text-pretty text-base lg:text-lg"
        style={{ color: 'var(--mk-text-muted)' }}
      >
        The parts that make an event feel like yours rather than a shared
        spreadsheet.
      </p>

      {/* Two-up on a phone as well as desktop. The four visuals are the
          tallest things in the features run and they are illustration, not
          proof — the two split mockups above carry that. Below lg they are
          dropped rather than shrunk, which is what turns four screens of
          scrolling into one. */}
      <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 lg:mt-16 lg:gap-x-16 lg:gap-y-20">
          {BENTO_FEATURES.map((feature, i) => (
            <ScrollReveal key={feature.title} direction="up" delay={i * 60} duration={600}>
              {/* The rule is a background, not a border, so it can draw
                  itself in as the row arrives (.mk-hairline-draw). */}
              <div className="mk-hairline-draw relative pt-6">
                <feature.icon className="h-5 w-5" style={{ color: 'var(--mk-gold)' }} aria-hidden />
                <h3 className="mt-4 text-xl lg:text-2xl">{feature.title}</h3>
                <p
                  className="mt-3 max-w-[48ch] text-sm leading-relaxed"
                  style={{ color: 'var(--mk-text-muted)' }}
                >
                  {feature.description}
                </p>
                <div className="mt-7 hidden lg:block">{feature.visual}</div>
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
    <div className="mk-container mt-16 lg:mt-32">
      <h2>Also included</h2>
      {/* Two-up from the smallest screen, and the gloss is desktop-only:
          ten single-column rows carrying a sentence each is a thousand
          pixels of list. The titles alone still name every capability. */}
      <div className="mt-8 grid grid-cols-2 gap-x-6 sm:gap-x-16 lg:mt-10">
        {LIST_FEATURES.map((feature, i) => (
          <ScrollReveal key={feature.title} direction="up" delay={i * 30} duration={500}>
            <div
              className="flex items-start gap-3 py-4 sm:gap-4 lg:py-5"
              style={{ borderTop: '1px solid var(--mk-rule-light)' }}
            >
              <feature.icon
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: 'var(--mk-gold)' }}
                aria-hidden
              />
              <div className="min-w-0">
                <span
                  className="block text-sm font-semibold sm:text-base"
                  style={{ color: 'var(--mk-text)' }}
                >
                  {feature.title}
                </span>
                <span
                  className="mt-1 hidden text-sm leading-relaxed sm:block"
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
