'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ScrollSmoother } from 'gsap/ScrollSmoother'

/**
 * The page as a front nine. A fixed right-edge rail of nine holes, one per
 * chapter: the current hole reads gold, played holes read bone, unplayed
 * read subtle. Clicking a hole plays to it. Desktop only; on mobile it does
 * not exist, and it is navigation flourish, never the only way anywhere.
 *
 * Scroll tracking writes classes straight to the DOM: no state, no
 * re-renders, one rAF-throttled listener.
 */

const HOLES: Array<{ id: string; label: string }> = [
  { id: 'hero', label: 'First tee' },
  { id: 'lead', label: 'The lead change' },
  { id: 'features', label: 'The game' },
  { id: 'tracer', label: 'Shot tracer' },
  { id: 'draft', label: 'The draft' },
  { id: 'admin', label: 'The committee' },
  { id: 'stats', label: 'By the numbers' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'clubhouse', label: 'The clubhouse' },
]

export function ScorecardRail() {
  const railRef = useRef<HTMLElement>(null)
  // Portaled to <body>: the rail must stay fixed to the viewport, and the
  // landing page's ScrollSmoother transforms #smooth-content, which turns
  // any fixed descendant into a scrolled-away absolute. Portal render is
  // client-only, hence the hydration-safe mounted gate.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const ticks = rail.querySelectorAll<HTMLElement>('[data-hole]')
    let raf = 0

    const paint = () => {
      raf = 0
      const mid = window.scrollY + window.innerHeight * 0.5
      let current = 0
      HOLES.forEach((hole, i) => {
        const el = document.getElementById(hole.id)
        if (el && el.getBoundingClientRect().top + window.scrollY <= mid) current = i
      })
      ticks.forEach((tick, i) => {
        tick.style.color =
          i === current
            ? 'var(--mk-gold)'
            : i < current
              ? 'var(--mk-text-muted)'
              : 'var(--mk-text-subtle)'
        tick.style.opacity = i <= current ? '1' : '0.55'
      })
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint)
    }

    paint()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [mounted])

  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Inside the smoother, native scrollIntoView fights the transform;
    // hand the jump to it when it exists.
    const smoother = ScrollSmoother.get()
    if (smoother) smoother.scrollTo(el, !reduce)
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  if (!mounted) return null

  return createPortal(
    <nav
      ref={railRef}
      aria-label="Page holes"
      // 1440 floor, not lg: below that the fixed rail overlaps the
      // container's right edge and steals clicks from real controls
      // (verified at 1280 wide laptops).
      // `marketing` keeps the mk-* token scope now that the portal renders
      // outside <main class="marketing">. The class also paints the page's
      // opaque green ground — the inline background below overrides it with
      // the nav's glass treatment, so the rail reads over the poster photo,
      // the dusk zone and the nightfall alike.
      className="marketing fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1 rounded-[var(--mk-radius-md)] px-1.5 py-3 min-[1440px]:flex"
      style={{
        backgroundColor: 'color-mix(in oklab, var(--mk-green-deep) 55%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--mk-rule-gold)',
      }}
    >
      <span
        aria-hidden
        className="mb-2 mk-label"
        style={{ color: 'var(--mk-text-subtle)', writingMode: 'vertical-rl' }}
      >
        Front nine
      </span>
      {HOLES.map((hole, i) => (
        <button
          key={hole.id}
          type="button"
          data-hole
          onClick={() => jump(hole.id)}
          title={hole.label}
          aria-label={`Hole ${i + 1}: ${hole.label}`}
          className="mk-data flex h-8 w-8 items-center justify-center text-xs transition-colors"
          style={{ color: 'var(--mk-text-subtle)' }}
        >
          {i + 1}
        </button>
      ))}
    </nav>,
    document.body,
  )
}
