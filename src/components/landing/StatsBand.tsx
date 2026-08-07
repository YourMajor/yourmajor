'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useReducedMotion } from 'motion/react'
import { GrainGradient } from '@paper-design/shaders-react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { useInView } from '@/hooks/useInView'

/**
 * A full-width band of product-truthful figures over a slow shader field.
 * Every number here is a fact of the product, not a metric: handicap
 * systems shipped, the player ceiling, holes scored live, the price of
 * starting. Invented counts (customers, events, growth) do not exist and
 * are banned by PRODUCT.md.
 *
 * Overdrive: the figures roll in like tote-board odometers (server render
 * and no-JS show the final digits; the roll only ever winds them back), and
 * the grain field stirs while the visitor scrolls, settling when they stop,
 * like grass in a gust. Reduced motion stills both.
 *
 * The GrainGradient is motion texture, not fake photography. Its colors are
 * the DESIGN.md tokens flattened to literals because canvas uniforms cannot
 * read CSS variables.
 */

const STATS = [
  { to: 4, label: 'Handicap systems' },
  { to: 144, label: 'Players per event' },
  { to: 18, label: 'Holes scored live' },
  { to: 0, label: 'To start', prefix: '$' },
]

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const ROW = '1.1em'

/* Module-level scroll-activity store: one passive listener while any
   subscriber is mounted, re-renders only when scrolling starts or stops. */
let scrolling = false
let settleTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()
function onWindowScroll() {
  if (!scrolling) {
    scrolling = true
    listeners.forEach((l) => l())
  }
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    scrolling = false
    listeners.forEach((l) => l())
  }, 180)
}
function subscribeScroll(cb: () => void) {
  if (listeners.size === 0) window.addEventListener('scroll', onWindowScroll, { passive: true })
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0) window.removeEventListener('scroll', onWindowScroll)
  }
}
const isScrolling = () => scrolling
const serverIsScrolling = () => false

/** Tote-board digits. The final value is the rendered default; on first
 *  sight each column rolls up from zero to where it already was. */
function Odometer({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0.4, once: true })
  const played = useRef(false)
  const text = `${prefix}${value}`

  useEffect(() => {
    if (!inView || played.current) return
    played.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cols = ref.current?.querySelectorAll<HTMLElement>('[data-odo]') ?? []
    cols.forEach((col, i) => {
      const target = Number(col.dataset.odo)
      if (!target) return
      col.animate(
        [
          { transform: 'translateY(0)' },
          { transform: `translateY(calc(-${target} * ${ROW}))` },
        ],
        {
          duration: 900 + i * 140,
          delay: i * 90,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'backwards',
        },
      )
    })
  }, [inView, ref])

  return (
    <>
      <span className="sr-only">{text}</span>
      <span
        ref={ref}
        aria-hidden
        className="mk-data inline-flex text-5xl lg:text-6xl"
        style={{ lineHeight: 1.1 }}
      >
        {text.split('').map((ch, i) =>
          /\d/.test(ch) ? (
            <span
              key={i}
              className="inline-block overflow-hidden"
              style={{ height: ROW }}
            >
              <span
                data-odo={ch}
                className="block"
                style={{ transform: `translateY(calc(-${ch} * ${ROW}))` }}
              >
                {DIGITS.map((d) => (
                  <span key={d} className="block text-center" style={{ height: ROW }}>
                    {d}
                  </span>
                ))}
              </span>
            </span>
          ) : (
            <span key={i}>{ch}</span>
          ),
        )}
      </span>
    </>
  )
}

export function StatsBand() {
  const reduce = useReducedMotion()
  const stirring = useSyncExternalStore(subscribeScroll, isScrolling, serverIsScrolling)

  return (
    <section
      id="stats"
      className="mk-rule-soft-t mk-rule-soft-b relative mt-24 overflow-hidden lg:mt-32"
      style={{
        // The raised ground blends in and out of the page green so the band
        // never starts or ends as a hard background line.
        background:
          'linear-gradient(to bottom, var(--mk-green-ground), var(--mk-green-raised) 22%, var(--mk-green-raised) 78%, var(--mk-green-ground))',
      }}
    >
      <div className="absolute inset-0 opacity-45" aria-hidden>
        <GrainGradient
          style={{ width: '100%', height: '100%' }}
          /* The DESIGN.md green tokens and gold-at-25%, converted to hex:
             the shader mount rejects oklch() strings. */
          colorBack="#041e0f"
          /* The last stop is the sunset token at low alpha: the hero's
             horizon warmth carried into the band's grass-in-wind field. */
          colors={['#0b2e1a', '#153c25', '#ca9c4e40', '#c2591e26']}
          shape="wave"
          softness={0.9}
          intensity={0.18}
          noise={0.3}
          speed={reduce ? 0 : stirring ? 1.15 : 0.35}
        />
      </div>

      <div className="mk-container relative grid grid-cols-2 gap-y-12 py-16 lg:grid-cols-4 lg:py-20">
        {STATS.map((stat, i) => (
          <ScrollReveal key={stat.label} direction="up" delay={i * 80} duration={600}>
            <div className="text-center">
              <Odometer value={stat.to} prefix={stat.prefix ?? ''} />
              <p
                className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--mk-text-subtle)' }}
              >
                {stat.label}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  )
}
