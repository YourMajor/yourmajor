'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { createTimeline, createMotionPath, createDrawable } from 'animejs'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Chapter 3 — the shot tracer. A broadcast-style par-5 hole map in crisp SVG,
 * drawn entirely from the marketing tokens. Scrolling through the pinned
 * section plays four ball flights along SVG paths (anime createMotionPath),
 * each leaving a thin bone tracer (createDrawable), while the data rail
 * brightens shot by shot and lands on a red Birdie. Scroll drives the anime
 * timeline through seek(); there are no timers anywhere in this chapter.
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

/* Flight paths, tee to hole. The fairway centreline and the yardage arcs are
   scenery; these four are the story. */
const FLIGHTS = [
  'M 205 600 C 190 520, 225 460, 208 350',
  'M 208 350 C 200 300, 185 260, 192 174',
  'M 192 174 C 195 150, 205 130, 201 112',
  'M 201 112 C 204 108, 207 106, 210 103',
]

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
            ball.setAttribute('cx', '210')
            ball.setAttribute('cy', '103')
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

          {/* Hole map */}
          <div className="mx-auto w-full max-w-[26rem] lg:col-span-7 lg:max-w-[30rem]">
            <svg
              ref={svgRef}
              viewBox="0 0 400 640"
              className="mk-cursor-marker h-auto w-full"
              role="img"
              aria-label="Hole map of a par five with four traced shots: drive, layup, approach and putt for birdie"
            >
              {/* First cut, then fairway, drawn as broadcast ribbons. */}
              <path
                d="M 205 600 C 175 500, 235 430, 205 340 C 185 275, 215 215, 200 150"
                fill="none"
                stroke="var(--mk-green-raised)"
                strokeWidth="110"
                strokeLinecap="round"
                opacity="0.45"
              />
              <path
                d="M 205 600 C 175 500, 235 430, 205 340 C 185 275, 215 215, 200 150"
                fill="none"
                stroke="var(--mk-green-raised)"
                strokeWidth="86"
                strokeLinecap="round"
              />

              {/* Green and its bunkers. Bone reads as sand on this ground. */}
              <ellipse
                cx="200"
                cy="112"
                rx="58"
                ry="42"
                fill="color-mix(in oklch, var(--mk-green-raised), var(--mk-bone) 12%)"
              />
              <ellipse cx="150" cy="152" rx="17" ry="10" fill="var(--mk-bone)" opacity="0.72" />
              <ellipse cx="254" cy="140" rx="14" ry="9" fill="var(--mk-bone)" opacity="0.72" />
              <ellipse cx="262" cy="350" rx="18" ry="11" fill="var(--mk-bone)" opacity="0.72" />

              {/* Yardage arcs, gold hairlines with mono labels. */}
              {[
                { y: 200, label: '100' },
                { y: 245, label: '150' },
                { y: 290, label: '200' },
              ].map((arc) => (
                <g key={arc.label}>
                  <path
                    d={`M 120 ${arc.y} Q 200 ${arc.y - 12} 280 ${arc.y}`}
                    fill="none"
                    stroke="var(--mk-gold)"
                    strokeWidth="1"
                    opacity="0.55"
                    strokeDasharray="3 5"
                  />
                  <text
                    x="292"
                    y={arc.y + 4}
                    fontSize="13"
                    fill="var(--mk-gold)"
                    opacity="0.8"
                    style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                  >
                    {arc.label}
                  </text>
                </g>
              ))}

              {/* Tee */}
              <rect x="197" y="606" width="16" height="5" rx="1.5" fill="var(--mk-bone)" opacity="0.9" />

              {/* The four flights. Static default is fully drawn. */}
              {FLIGHTS.map((d) => (
                <path
                  key={d}
                  data-flight
                  d={d}
                  fill="none"
                  stroke="var(--mk-bone)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.92"
                />
              ))}

              {/* Hole and flag */}
              <circle cx="210" cy="103" r="3" fill="var(--mk-green-deep)" />
              <line x1="210" y1="103" x2="210" y2="80" stroke="var(--mk-gold)" strokeWidth="1.5" />
              <path d="M 210 80 L 224 85 L 210 90 Z" fill="var(--mk-gold)" />

              {/* The ball. Static rest position is at the hole. */}
              <circle data-ball cx="210" cy="103" r="4.5" fill="var(--mk-bone)" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
