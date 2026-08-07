'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { HeroCodeSearch } from './HeroCodeSearch'
import heroCourse from '../../../public/images/marketing/hero-course.webp'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Chapter 1 — the cinematic hero. A full-bleed dusk course backdrop under a
 * staged title reveal: Caslon words rise one by one (pure CSS, see .mk-word),
 * then the gold rule draws itself under the last word. As the visitor scrolls
 * away, GSAP scrubs a slow settle on the media (scale 1.06 -> 1 at ~0.25x
 * parallax) while the green scrim deepens, handing the photo off to the green
 * page ground without a visible seam.
 *
 * VIDEO DROP-IN SLOT: to upgrade the backdrop to motion, replace the <Image>
 * below with, inside the same absolutely-positioned media layer:
 *
 *   <video autoPlay muted loop playsInline preload="metadata"
 *          poster={heroCourse.src}
 *          className="absolute inset-0 h-full w-full object-cover">
 *     <source src="/images/marketing/hero-course.webm" type="video/webm" />
 *   </video>
 *
 * Same layer, same object-cover, poster = today's image: zero layout change.
 * Keep the scrim divs; they carry headline contrast over any footage.
 *
 * The backdrop is generated scenery (sanctioned by DESIGN.md's v3 range):
 * artifact-checked, never standing in for product proof.
 */

const HEADLINE: Array<{ word: string; gold?: boolean }> = [
  { word: 'Every' },
  { word: 'group' },
  { word: 'has' },
  { word: 'a' },
  { word: 'major.', gold: true },
]

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const [joining, setJoining] = useState(false)
  const joinBtnRef = useRef<HTMLButtonElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        () => {
          // The settle: the media arrives very slightly enlarged and relaxes
          // to rest as the visitor scrolls off the hero, drifting slower than
          // the page (0.25x) so the course reads as far away. The copy block
          // drifts the other way, slightly faster, so leaving the hero reads
          // as a camera move rather than a page scroll.
          const trigger = {
            trigger: sectionRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          }
          gsap.fromTo(
            mediaRef.current,
            { scale: 1.06, yPercent: 0 },
            { scale: 1, yPercent: 12, ease: 'none', scrollTrigger: trigger },
          )
          gsap.to(copyRef.current, {
            yPercent: -10,
            opacity: 0.35,
            ease: 'none',
            scrollTrigger: trigger,
          })
        },
      )
      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative flex min-h-[100dvh] items-center overflow-hidden pt-24 pb-20"
    >
      {/* Media stage. See VIDEO DROP-IN SLOT above. */}
      <div ref={mediaRef} className="absolute inset-0 will-change-transform">
        <Image
          src={heroCourse}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover"
        />
      </div>

      {/* Scrims: headline contrast at the top left, and the handoff into the
          green page ground at the bottom. Both tinted to the world, never
          neutral black. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(115deg, oklch(0.21 0.045 155 / 0.72) 0%, oklch(0.21 0.045 155 / 0.28) 45%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%]"
        style={{
          background:
            'linear-gradient(to bottom, transparent, var(--mk-green-ground))',
        }}
      />

      {/* One ball flight: launched from the fairway at the lower left, it
          climbs over the headline and lands on the green at the right. Pure
          CSS (see .mk-hero-tracer); decoration, desktop only. */}
      <svg
        aria-hidden
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="mk-hero-tracer pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      >
        <defs>
          {/* The tail fades in from nothing so the launch reads as leaving
              the turf, not a line starting mid-air. */}
          <linearGradient id="mk-tracer-fade" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="var(--mk-gold)" stopOpacity="0" />
            <stop offset="0.22" stopColor="var(--mk-gold)" stopOpacity="0.65" />
            <stop offset="1" stopColor="var(--mk-gold)" stopOpacity="0.65" />
          </linearGradient>
        </defs>
        <path
          d="M 470 930 C 560 480, 660 170, 810 200 C 990 240, 1130 440, 1200 620"
          pathLength="1"
          fill="none"
          stroke="url(#mk-tracer-fade)"
          strokeWidth="1.5"
        />
        <circle className="mk-tracer-ball" cx="1200" cy="620" r="3.5" fill="var(--mk-bone)" />
      </svg>

      <div className="mk-container relative z-10 w-full">
        <div ref={copyRef} className="max-w-2xl">
          <h1 className="text-balance">
            {HEADLINE.map((part, i) => (
              <span
                key={part.word}
                className="mk-word mr-[0.28em] last:mr-0"
                style={
                  {
                    '--mk-word-i': i,
                    color: part.gold ? 'var(--mk-gold)' : undefined,
                  } as React.CSSProperties
                }
              >
                {part.word}
                {part.gold && <span className="mk-rule-draw mt-3" aria-hidden />}
              </span>
            ))}
          </h1>

          <p
            className="mt-7 max-w-[46ch] text-lg leading-relaxed"
            style={{ color: 'var(--mk-text-muted)' }}
          >
            Live leaderboards, digital scorecards, and powerup drafts.
            Everything your golf group needs.
          </p>

          <div className="mt-10 flex min-h-12 flex-col gap-3 sm:flex-row sm:items-start">
            <Link href="/auth/signup" className="mk-btn mk-btn-primary">
              Create a tournament
            </Link>
            {joining ? (
              <HeroCodeSearch
                onDismiss={() => {
                  setJoining(false)
                  // Focus returns to the control that opened the form.
                  requestAnimationFrame(() => joinBtnRef.current?.focus())
                }}
              />
            ) : (
              <button
                ref={joinBtnRef}
                type="button"
                className="mk-btn mk-btn-secondary"
                onClick={() => setJoining(true)}
              >
                Join with a code
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
