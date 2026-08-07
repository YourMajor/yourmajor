'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * The one screenprint moment on the page (DESIGN.md v3: exactly one; a second
 * is drift). The features heading set as a tournament poster: oversized
 * Caslon in two flat inks, a gold layer misregistered behind the bone layer,
 * pulled into register as the visitor scrolls through. The halftone band is
 * pure CSS dots, not a shader; flat ink wants a flat texture.
 *
 * No pin. Static renditions (mobile, reduced motion) keep a small permanent
 * misregister, which is the poster's charm, not a defect.
 */

const LINES = ['Built for', 'competitive', 'golfers']

export function PosterInterstitial() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLSpanElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        () => {
          gsap.fromTo(
            ghostRef.current,
            { x: 10, y: 10 },
            {
              x: 3,
              y: 3,
              ease: 'none',
              scrollTrigger: {
                trigger: sectionRef.current,
                start: 'top 85%',
                end: 'center center',
                scrub: true,
              },
            },
          )
        },
      )
      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <div
      ref={sectionRef}
      className="mk-container relative flex min-h-[60vh] flex-col justify-center py-16"
    >
      {/* Halftone texture band, CSS only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-8 right-0 w-1/2 opacity-[0.16]"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--mk-gold) 1px, transparent 1.5px)',
          backgroundSize: '14px 14px',
          maskImage: 'linear-gradient(to left, black, transparent)',
        }}
      />

      <h2
        className="relative uppercase"
        style={{
          fontSize: 'clamp(2.75rem, 7.5vw, 6.5rem)',
          lineHeight: 0.98,
          letterSpacing: '0.01em',
        }}
      >
        {/* Gold ink, misregistered. */}
        <span
          ref={ghostRef}
          aria-hidden
          className="absolute inset-0 select-none"
          style={{ color: 'var(--mk-gold)', transform: 'translate(3px, 3px)' }}
        >
          {LINES.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </span>
        {/* Bone ink, front. */}
        <span className="relative" style={{ color: 'var(--mk-text)' }}>
          {LINES.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </span>
      </h2>

      <p
        className="mt-8 max-w-[65ch] text-base lg:text-lg"
        style={{ color: 'var(--mk-text-muted)' }}
      >
        Everything you need to run tournament golf, from casual weekend events
        to season-long leagues.
      </p>
    </div>
  )
}
