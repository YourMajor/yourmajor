'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Image from 'next/image'
import { createTimeline, createMotionPath, createDrawable } from 'animejs'
import tracerHole from '../../../public/images/marketing/tracer-hole.webp'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Chapter 3 — the shot tracer. A dusk aerial photograph of a par 5
 * (generated scenery, artifact-checked, swap-for-real list) with the four
 * ball flights traced over it in the photo's own coordinate space.
 * Scrolling through the pinned section plays the flights along SVG paths
 * (anime createMotionPath), each leaving a bone tracer (createDrawable),
 * while the data rail brightens shot by shot and lands on a red Birdie.
 * Scroll drives the anime timeline through seek(); no timers anywhere.
 *
 * Static renditions (mobile, reduced motion, no JS) show the finished hole:
 * all four tracers drawn, ball at the hole, full data rail. The scrub only
 * ever winds that picture back, so nothing is gated behind it.
 *
 * Names and figures are a demonstration, and the section says so.
 */

const SHOTS = [
  { n: '1', label: 'Drive', dist: '278 yds', left: '267 to the green' },
  { n: '2', label: 'Layup', dist: '195 yds', left: '72 to the green' },
  { n: '3', label: 'Approach', dist: '68 yds', left: '12 ft for birdie' },
  { n: '4', label: 'Putt', dist: '12 ft', left: 'holed' },
]

/* Flight paths, tee to hole, in the aerial photograph's coordinate space
   (1024x1536): tee box bottom-center, landing zones up the S-curve fairway,
   hole at the flag on the upper green. */
const FLIGHTS = [
  'M 512 1210 C 470 1050, 460 900, 490 780',
  'M 490 780 C 500 690, 530 590, 520 520',
  'M 520 520 C 525 465, 540 410, 548 362',
  'M 548 362 C 550 358, 552 355, 553 352',
]

const HOLE = { x: 553, y: 352 }

const SHOT_WINDOWS = [
  { at: 0, dur: 900 },
  { at: 1100, dur: 700 },
  { at: 2000, dur: 600 },
  { at: 2800, dur: 450 },
]

export function ShotTracerChapter() {
  const sectionRef = useRef<HTMLElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const railRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()

      media.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        () => {
          const svg = svgRef.current
          const rail = railRef.current
          if (!svg || !rail) return

          const ball = svg.querySelector<SVGCircleElement>('[data-ball]')
          const flights = svg.querySelectorAll<SVGPathElement>('[data-flight]')
          const rows = rail.querySelectorAll<HTMLElement>('[data-shot]')
          const result = rail.querySelector<HTMLElement>('[data-result]')
          if (!ball || flights.length !== 4 || rows.length !== 4 || !result) return

          const tl = createTimeline({ autoplay: false })

          // Rest-state pieces wind back to the start of the round.
          rows.forEach((row) => tl.set(row, { opacity: 0.35 }, 0))
          tl.set(result, { opacity: 0, translateY: 8 }, 0)

          SHOT_WINDOWS.forEach((win, i) => {
            const flight = flights[i]
            const drawable = createDrawable(flight)
            const { translateX, translateY } = createMotionPath(flight)

            tl.set(drawable, { draw: '0 0' }, 0)
            tl.add(drawable, { draw: '0 1', duration: win.dur, ease: 'inOutSine' }, win.at)
            tl.add(ball, { translateX, translateY, duration: win.dur, ease: 'inOutSine' }, win.at)
            tl.add(rows[i], { opacity: 1, translateX: [-6, 0], duration: 260, ease: 'outCubic' }, win.at)
          })

          tl.add(result, { opacity: 1, translateY: 0, duration: 320, ease: 'outCubic' }, 3300)

          // createMotionPath emits absolute path coordinates as transforms,
          // so the ball sits at the SVG origin while the paths carry it.
          ball.setAttribute('cx', '0')
          ball.setAttribute('cy', '0')

          const trigger = ScrollTrigger.create({
            trigger: sectionRef.current,
            start: 'top top',
            end: '+=200%',
            pin: true,
            scrub: true,
            onUpdate: (self) => {
              tl.seek(self.progress * tl.duration)
            },
          })

          tl.seek(0)

          return () => {
            trigger.kill()
            tl.revert()
            ball.setAttribute('cx', String(HOLE.x))
            ball.setAttribute('cy', String(HOLE.y))
          }
        },
      )

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} id="tracer" className="relative mt-24 flex min-h-[100dvh] items-center lg:mt-32">
      <div className="mk-container w-full py-16">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Data rail */}
          <div ref={railRef} className="lg:col-span-5">
            <h2>Every shot, on the record</h2>
            <p
              className="mt-4 max-w-[46ch] text-base leading-relaxed"
              style={{ color: 'var(--mk-text-muted)' }}
            >
              Scores, putts, fairways and greens go in as they happen, so the
              board and the stats are live before the group reaches the next tee.
            </p>

            <div className="mt-10">
              <div
                className="flex items-baseline justify-between pb-3"
                style={{ borderBottom: '2px solid var(--mk-gold)' }}
              >
                <span
                  className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: 'var(--mk-gold)' }}
                >
                  Hole 14 · Par 5
                </span>
                <span className="mk-data text-sm" style={{ color: 'var(--mk-text-muted)' }}>
                  545 yds
                </span>
              </div>

              {SHOTS.map((shot) => (
                <div
                  key={shot.n}
                  data-shot
                  className="flex items-baseline gap-4 py-3.5"
                  style={{ borderBottom: '1px solid var(--mk-rule-light)' }}
                >
                  <span className="mk-data w-5 text-sm" style={{ color: 'var(--mk-gold)' }}>
                    {shot.n}
                  </span>
                  <span
                    className="w-24 text-sm font-semibold"
                    style={{ color: 'var(--mk-text)' }}
                  >
                    {shot.label}
                  </span>
                  <span className="mk-data text-sm" style={{ color: 'var(--mk-text)' }}>
                    {shot.dist}
                  </span>
                  <span
                    className="ml-auto text-sm"
                    style={{ color: 'var(--mk-text-subtle)' }}
                  >
                    {shot.left}
                  </span>
                </div>
              ))}

              <div data-result className="flex items-baseline gap-4 pt-5">
                <span
                  className="mk-data text-2xl"
                  style={{ color: 'var(--mk-under-par)' }}
                >
                  Birdie
                </span>
                <span className="text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
                  4 on the card, one under
                </span>
              </div>

              <p className="mt-8 text-xs" style={{ color: 'var(--mk-text-subtle)' }}>
                Demonstration hole
              </p>
            </div>
          </div>

          {/* Hole map: the aerial photograph (generated dusk scenery,
              artifact-checked, on the swap-for-real list) with the four
              flights traced over it in the photo's own coordinate space.
              Height is capped so the pinned viewport never crops the tee
              off the bottom. */}
          <div className="mx-auto w-full lg:col-span-7">
            <div
              className="relative mx-auto overflow-hidden"
              style={{
                // Width derives from the height cap so the 2:3 frame always
                // matches the SVG viewBox exactly and the tee is never
                // cropped off the bottom of the pinned viewport.
                width: 'min(100%, calc(min(74vh, 44rem) * 2 / 3))',
                aspectRatio: '2 / 3',
                borderRadius: 'var(--mk-radius-lg)',
                border: '1px solid color-mix(in oklch, var(--mk-gold) 35%, transparent)',
                boxShadow: 'var(--mk-shadow-plate)',
              }}
            >
              <Image
                src={tracerHole}
                alt=""
                fill
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover"
                placeholder="blur"
              />
              {/* A whisper of the page's dusk over the photo so the bone
                  tracers stay the brightest thing on it. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'color-mix(in oklch, var(--mk-dusk) 18%, transparent)',
                }}
              />
              <svg
                ref={svgRef}
                viewBox="0 0 1024 1536"
                preserveAspectRatio="xMidYMid slice"
                className="mk-cursor-marker absolute inset-0 h-full w-full"
                role="img"
                aria-label="Aerial view of a par five with four traced shots: drive, layup, approach and putt for birdie"
              >
                {/* The four flights. Static default is fully drawn. */}
                {FLIGHTS.map((d) => (
                  <path
                    key={d}
                    data-flight
                    d={d}
                    fill="none"
                    stroke="var(--mk-bone)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.95"
                  />
                ))}

                {/* Hole ring at the flag. */}
                <circle
                  cx={HOLE.x}
                  cy={HOLE.y}
                  r="10"
                  fill="none"
                  stroke="var(--mk-gold)"
                  strokeWidth="2"
                  opacity="0.9"
                />

                {/* The ball. Static rest position is at the hole. */}
                <circle data-ball cx={HOLE.x} cy={HOLE.y} r="7" fill="var(--mk-bone)" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
