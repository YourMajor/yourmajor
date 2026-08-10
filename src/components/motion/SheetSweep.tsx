'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * A single gold pass travelling down a bone sheet as it crosses the
 * viewport — the eye of the person checking the card, not another
 * entrance. Renders its own overlay, so the host stays a server component;
 * the host only needs `position: relative` and `overflow: hidden` (see
 * .mk-sheet-trace).
 *
 * ScrollTrigger rather than `animation-timeline: view()`: this surface runs
 * ScrollSmoother, which transforms the scrolled content and leaves CSS
 * scroll-driven animations frozen at their first frame.
 */
export function SheetSweep() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        () => {
          gsap.fromTo(
            ref.current,
            { yPercent: -100 },
            {
              yPercent: 280,
              ease: 'none',
              scrollTrigger: {
                trigger: ref.current?.parentElement,
                start: 'top 90%',
                end: 'bottom 30%',
                scrub: 1,
              },
            },
          )
        },
      )
      return () => media.revert()
    },
    { scope: ref },
  )

  return <div ref={ref} aria-hidden className="mk-sheet-sweep" />
}
