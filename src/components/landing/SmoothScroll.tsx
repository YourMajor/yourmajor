'use client'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, useGSAP)

/**
 * Activates ScrollSmoother for the landing page: the (main) layout provides
 * the #smooth-wrapper / #smooth-content structure (inert on every other
 * route), and this component — mounted first on the page so it exists
 * before the chapters' ScrollTriggers — turns it on. Desktop full-motion
 * only, per the house gate; mobile, reduced motion and every other route
 * keep native scrolling. effects: true enables data-speed parallax on
 * marked elements inside the content.
 *
 * Fixed or sticky elements must live OUTSIDE #smooth-content (GlobalNav,
 * BottomTabBar via the layout; ScorecardRail via portal) — the content
 * transform breaks fixed positioning for descendants.
 */
export function SmoothScroll() {
  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add(
      '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
      () => {
        const smoother = ScrollSmoother.create({
          wrapper: '#smooth-wrapper',
          content: '#smooth-content',
          smooth: 1.2,
          effects: true,
          smoothTouch: false,
        })
        return () => smoother.kill()
      },
    )
    return () => media.revert()
  })
  return null
}
