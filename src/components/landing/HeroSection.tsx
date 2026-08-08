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
 * Chapter 1 — the cinematic hero. At desktop rest the photograph is a
 * squared window on the right of the green ground (clip-path inset), the
 * headline and CTAs beside it. The first scrolled pixel expands the window
 * to full bleed (scroll-expand: clip inset -> 0 while the image settles
 * from a 1.12 zoom to exactly 1), and only once the photograph is at rest
 * does the scrubbed ball flight play — the trail is registered to the
 * course in the picture, so the flight never overlaps the zoom. The hero
 * pins through both beats, then releases. Mobile, reduced motion and no-JS
 * all keep the static full-bleed photograph with the finished flight.
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
  const copyRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<HTMLDivElement>(null)
  const [joining, setJoining] = useState(false)
  const joinBtnRef = useRef<HTMLButtonElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        () => {
          // No media zoom or drift: the photograph must hold still so the
          // shot trail stays registered to the course (the flight lands on
          // the green in the picture). Only the copy drifts on departure.
          gsap.to(copyRef.current, {
            yPercent: -10,
            opacity: 0.35,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          })

          // The flight is scrubbed: the drive plays as the visitor starts
          // to scroll and has landed by ~60% of the hero's departure. The
          // static default (fully drawn) only ever winds back, so mobile,
          // reduced motion and no-JS all show the finished shot.
          const flight = sectionRef.current?.querySelector<SVGPathElement>('[data-hero-flight]')
          const ball = sectionRef.current?.querySelector<SVGCircleElement>('[data-hero-ball]')
          if (flight && ball && frameRef.current && zoomRef.current) {
            // A numeric proxy: GSAP string-swaps stroke-dashoffset on SVG
            // instead of tweening it, and the inline style also has to win
            // over the stylesheet's static drawn state.
            const draw = { v: 1 }
            flight.style.strokeDashoffset = '1'
            // The hero holds still (pin) for a runway that plays two beats:
            // the window expands to full bleed, then the scrub plays the
            // flight. The page releases once the ball drops.
            const heroTl = gsap.timeline({
              scrollTrigger: {
                trigger: sectionRef.current,
                // Anchor to the hero's resting offset (the nav's height):
                // waiting for 'top top' costs one nav-height of dead scroll
                // before the expand begins. This way the very first scrolled
                // pixel starts opening the window.
                start: () => {
                  const el = sectionRef.current
                  if (!el) return 'top top'
                  const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY)
                  return `top ${top}px`
                },
                end: '+=150%',
                pin: true,
                anticipatePin: 1,
                scrub: true,
              },
            })
            // Beat one — scroll-expand. The resting crop frames the sunset
            // band and fairway on the right of the photograph; the window
            // opens to full bleed while the image settles from a gentle
            // zoom to exactly scale 1, so the tracer that follows stays
            // registered to the course. Radius 6px -> 0 per the world's
            // squared shapes. fromTo keeps the CSS default (full bleed)
            // as the static state for every non-animated rendition.
            heroTl.fromTo(
              frameRef.current,
              { clipPath: 'inset(18% 6% 22% 50% round 6px)' },
              { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut', duration: 0.34 },
              0,
            )
            heroTl.fromTo(
              zoomRef.current,
              { scale: 1.12 },
              { scale: 1, ease: 'power2.inOut', duration: 0.34 },
              0,
            )
            // Beat two — the shot. Flown by ~80% of the runway; the rest
            // of the pin is a settle beat with the ball at rest, so the
            // shot always completes before the page moves on.
            heroTl.to(
              draw,
              {
                v: 0,
                ease: 'none',
                duration: 0.4,
                onUpdate: () => {
                  flight.style.strokeDashoffset = String(draw.v)
                },
              },
              0.42,
            )
            // The ball only fades up as the flight finishes.
            heroTl.fromTo(
              ball,
              { opacity: 0 },
              { opacity: 1, ease: 'power2.in', duration: 0.12 },
              0.68,
            )
            // Hold to the end of the pin.
            heroTl.to({}, { duration: 0.18 })
          }
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
      {/* Media stage. See VIDEO DROP-IN SLOT above. The outer div is the
          scroll-expand clip target, the inner div the zoom target: clip and
          scale cannot share an element (the transform would scale the clip
          window with it). CSS default is unclipped full bleed. */}
      <div ref={frameRef} className="absolute inset-0">
        <div ref={zoomRef} className="absolute inset-0">
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

      {/* One ball flight, scrubbed by scroll (see useGSAP above): struck
          from the distant fairway, a tall wide climb that crosses in front
          of the headline, a steep drop to the near green, its own bounce
          parabola, a second hop, and the roll to a stop. Sits above the
          copy (z-20 vs the container's z-10); a 1.5px line never costs
          legibility. Static renditions show the finished flight. */}
      <svg
        aria-hidden
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="mk-hero-tracer pointer-events-none absolute inset-0 z-20 hidden h-full w-full lg:block"
      >
        <defs>
          {/* Fades in at the strike point on the distant fairway. */}
          <linearGradient
            id="mk-tracer-fade"
            gradientUnits="userSpaceOnUse"
            x1="880"
            y1="470"
            x2="370"
            y2="750"
          >
            <stop offset="0" stopColor="var(--mk-gold)" stopOpacity="0.1" />
            <stop offset="0.18" stopColor="var(--mk-gold)" stopOpacity="0.68" />
            <stop offset="1" stopColor="var(--mk-gold)" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <path
          data-hero-flight
          d="M 880 470 C 810 180, 705 78, 630 86 C 552 94, 505 460, 486 716 C 479 662, 450 654, 440 708 C 435 731, 424 727, 416 738 L 372 750"
          pathLength="1"
          fill="none"
          stroke="url(#mk-tracer-fade)"
          strokeWidth="1.5"
        />
        <circle
          data-hero-ball
          className="mk-tracer-ball"
          cx="372"
          cy="750"
          r="3.5"
          fill="var(--mk-bone)"
        />
      </svg>

      <div className="mk-container relative z-10 w-full">
        <div ref={copyRef} className="max-w-2xl">
          {/* Real spaces between the word spans: inline-block spans with
              margin gaps alone read as one run-on token to screen readers,
              find-in-page and copy-paste. */}
          <h1 className="text-balance">
            {HEADLINE.map((part, i) => (
              <span key={part.word}>
                <span
                  className="mk-word"
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
                {i < HEADLINE.length - 1 ? ' ' : null}
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

          {/* The price of entry, stated where the decision happens: the
              first "free" signal otherwise sits several thousand pixels
              down the page. Facts match the pricing tiers. */}
          <p className="mt-4 text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
            Free for groups up to 16. No card required.
          </p>
        </div>
      </div>
    </section>
  )
}
