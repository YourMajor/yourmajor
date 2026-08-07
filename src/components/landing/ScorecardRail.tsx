'use client'

import { useEffect, useRef } from 'react'

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
  }, [])

  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <nav
      ref={railRef}
      aria-label="Page holes"
      // 1440 floor, not lg: below that the fixed rail overlaps the
      // container's right edge and steals clicks from real controls
      // (verified at 1280 wide laptops).
      className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1 min-[1440px]:flex"
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
    </nav>
  )
}
