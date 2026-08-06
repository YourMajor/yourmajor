'use client'

import { useEffect, useRef } from 'react'
import { createTimeline, type Timeline } from 'animejs'

/**
 * Runs an anime.js timeline only while its element is on screen, and not at all
 * under reduced motion.
 *
 * Two rules this deliberately follows, both of which have bitten this surface
 * before:
 *  - Content is never gated behind the observer. The markup the timeline drives
 *    renders in its readable rest state; the timeline only ever moves it away
 *    from that state and back. If this hook never runs, nothing is missing.
 *  - Nothing animates off screen. A set-piece looping in a viewport nobody is
 *    looking at is wasted main thread.
 *
 * `build` must be stable, so define it at module scope rather than inline.
 */
export function useTimelineInView<T extends HTMLElement>(
  build: (tl: Timeline, root: T) => void,
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const tl = createTimeline({ loop: true, autoplay: false })
    build(tl, root)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) tl.play()
        else tl.pause()
      },
      { threshold: 0.35 },
    )
    observer.observe(root)

    return () => {
      observer.disconnect()
      tl.revert()
    }
  }, [build])

  return ref
}
