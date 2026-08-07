'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { createTimeline, createMotionPath, createDrawable } from 'animejs'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Chapter 3 — the shot tracer. A textured vector aerial of a par 5 at
 * dusk, drawn entirely from the marketing tokens (every color is a
 * color-mix of tokens; the grain is SVG turbulence), with the five
 * strokes traced over it. Scrolling through the pinned section plays the
 * strokes along SVG paths (anime createMotionPath), each leaving a bone
 * tracer (createDrawable), while the data rail brightens shot by shot.
 * Scroll drives the anime timeline through seek(); no timers anywhere.
 *
 * Static renditions (mobile, reduced motion, no JS) show the finished hole:
 * all four tracers drawn, ball at the hole, full data rail. The scrub only
 * ever winds that picture back, so nothing is gated behind it.
 *
 * Names and figures are a demonstration, and the section says so.
 */

/* Five strokes, read the way the user asked for: one real hit, two little
   mounds, two putts. A par, told honestly. */
const SHOTS = [
  { n: '1', label: 'Drive', dist: '282 yds', left: '263 to the green' },
  { n: '2', label: 'Long iron', dist: '205 yds', left: '58 to the green' },
  { n: '3', label: 'Pitch', dist: '58 yds', left: '28 ft for birdie' },
  { n: '4', label: 'Putt', dist: '28 ft', left: 'to 2 ft' },
  { n: '5', label: 'Putt', dist: '2 ft', left: 'holed' },
]

/* Trajectories in the aerial photograph's coordinate space (1024x1536),
   tee box bottom-center to the flag top-center: the drive is one big
   drawing arc, the two mid shots are smaller mounds bulging off the line,
   and the putts are two short strokes across the green. */
const FLIGHTS = [
  'M 505 1300 C 560 1120, 560 985, 520 850',
  'M 520 850 C 478 745, 468 655, 505 560',
  'M 505 560 C 548 455, 556 320, 522 205',
  'M 522 205 L 534 152',
  'M 534 152 L 537 131',
]

const HOLE = { x: 537, y: 131 }

const SHOT_WINDOWS = [
  { at: 0, dur: 900 },
  { at: 1100, dur: 650 },
  { at: 1950, dur: 600 },
  { at: 2750, dur: 420 },
  { at: 3350, dur: 280 },
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
          if (!ball || flights.length !== FLIGHTS.length || rows.length !== SHOTS.length || !result) return

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

          tl.add(result, { opacity: 1, translateY: 0, duration: 320, ease: 'outCubic' }, 3800)

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
                <span className="mk-data text-2xl" style={{ color: 'var(--mk-text)' }}>
                  Par
                </span>
                <span className="text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
                  5 on the card, every stroke kept
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
              <svg
                ref={svgRef}
                viewBox="0 0 1024 1536"
                preserveAspectRatio="xMidYMid slice"
                className="absolute inset-0 h-full w-full"
                role="img"
                aria-label="Aerial view of a par five with five traced strokes: drive, long iron, pitch and two putts for par"
              >
                <defs>
                  {/* Film grain: SVG turbulence, bone-tinted, static. */}
                  <filter id="tr-grain">
                    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" />
                    <feColorMatrix
                      type="matrix"
                      values="0 0 0 0 0.95  0 0 0 0 0.93  0 0 0 0 0.88  0 0 0 0.09 0"
                    />
                  </filter>
                  <radialGradient id="tr-sunset" cx="0.5" cy="0.04" r="0.9">
                    <stop offset="0" stopColor="color-mix(in oklch, var(--mk-sunset) 30%, transparent)" />
                    <stop offset="0.55" stopColor="transparent" />
                  </radialGradient>
                  <radialGradient id="tr-vignette" cx="0.5" cy="0.5" r="0.75">
                    <stop offset="0.62" stopColor="transparent" />
                    <stop offset="1" stopColor="color-mix(in oklch, var(--mk-night) 55%, transparent)" />
                  </radialGradient>
                </defs>

                {/* Dusky ground. */}
                <rect
                  width="1024"
                  height="1536"
                  fill="color-mix(in oklch, var(--mk-dusk) 32%, var(--mk-green-deep))"
                />

                {/* Rough and heather: warm dune blobs flanking the hole,
                    catching the low light. */}
                <path
                  d="M 0 0 H 1024 V 1536 H 0 Z M 505 1330 C 400 1180, 430 1000, 520 850 C 590 730, 560 640, 505 560 C 430 450, 460 300, 532 180 C 560 130, 600 120, 640 160 L 700 260 C 740 380, 690 520, 640 640 C 600 760, 640 900, 680 1020 C 710 1140, 660 1280, 560 1360 Z"
                  fill="color-mix(in oklch, var(--mk-sunset) 22%, var(--mk-green-deep))"
                  opacity="0.5"
                  fillRule="evenodd"
                />
                <ellipse cx="180" cy="420" rx="190" ry="300" fill="color-mix(in oklch, var(--mk-sunset) 34%, var(--mk-green-raised))" opacity="0.28" />
                <ellipse cx="850" cy="700" rx="200" ry="340" fill="color-mix(in oklch, var(--mk-sunset) 30%, var(--mk-green-raised))" opacity="0.24" />
                <ellipse cx="230" cy="1150" rx="220" ry="280" fill="color-mix(in oklch, var(--mk-sunset) 36%, var(--mk-green-deep))" opacity="0.3" />
                <ellipse cx="820" cy="1300" rx="190" ry="240" fill="color-mix(in oklch, var(--mk-sunset) 28%, var(--mk-green-deep))" opacity="0.26" />

                {/* First cut, then the fairway ribbon. */}
                <path
                  d="M 505 1330 C 470 1100, 560 960, 520 850 C 470 730, 468 660, 505 560 C 545 450, 556 320, 528 210"
                  fill="none"
                  stroke="color-mix(in oklch, var(--mk-green-raised) 70%, var(--mk-green-deep))"
                  strokeWidth="230"
                  strokeLinecap="round"
                />
                <path
                  d="M 505 1330 C 470 1100, 560 960, 520 850 C 470 730, 468 660, 505 560 C 545 450, 556 320, 528 210"
                  fill="none"
                  stroke="var(--mk-green-raised)"
                  strokeWidth="172"
                  strokeLinecap="round"
                />
                {/* Mown crossbands: dashes along the centreline read as
                    stripes across the fairway. */}
                <path
                  d="M 505 1330 C 470 1100, 560 960, 520 850 C 470 730, 468 660, 505 560 C 545 450, 556 320, 528 210"
                  fill="none"
                  stroke="color-mix(in oklch, var(--mk-bone) 10%, var(--mk-green-raised))"
                  strokeWidth="172"
                  strokeDasharray="46 52"
                  opacity="0.35"
                />

                {/* Bunkers with a shadowed lip on the light's far side. */}
                <ellipse cx="612" cy="808" rx="36" ry="21" fill="color-mix(in oklch, var(--mk-bone) 82%, var(--mk-sunset))" />
                <ellipse cx="616" cy="812" rx="36" ry="21" fill="none" stroke="color-mix(in oklch, var(--mk-green-deep) 60%, transparent)" strokeWidth="5" opacity="0.5" />
                <ellipse cx="430" cy="596" rx="29" ry="17" fill="color-mix(in oklch, var(--mk-bone) 82%, var(--mk-sunset))" />
                <ellipse cx="404" cy="238" rx="31" ry="18" fill="color-mix(in oklch, var(--mk-bone) 84%, var(--mk-sunset))" />
                <ellipse cx="662" cy="262" rx="24" ry="15" fill="color-mix(in oklch, var(--mk-bone) 84%, var(--mk-sunset))" />

                {/* The green, its fringe, and the tee box. */}
                <ellipse cx="532" cy="180" rx="132" ry="95" fill="none" stroke="color-mix(in oklch, var(--mk-green-raised) 80%, var(--mk-bone))" strokeWidth="16" opacity="0.55" />
                <ellipse cx="532" cy="180" rx="124" ry="88" fill="color-mix(in oklch, var(--mk-bone) 13%, var(--mk-green-raised))" />
                <rect x="468" y="1286" width="76" height="46" rx="6" fill="color-mix(in oklch, var(--mk-bone) 8%, var(--mk-green-raised))" />

                {/* Long dusk shadows falling from the left. */}
                <path
                  d="M 0 300 L 380 520 L 300 700 L 0 560 Z"
                  fill="var(--mk-green-deep)"
                  opacity="0.2"
                />
                <path
                  d="M 60 900 L 430 1030 L 360 1200 L 0 1100 Z"
                  fill="var(--mk-green-deep)"
                  opacity="0.22"
                />

                {/* Sunset wash, vignette, then grain over everything. */}
                <rect width="1024" height="1536" fill="url(#tr-sunset)" />
                <rect width="1024" height="1536" fill="url(#tr-vignette)" />
                <rect width="1024" height="1536" filter="url(#tr-grain)" opacity="0.55" />

                {/* The five strokes. Static default is fully drawn. */}
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
