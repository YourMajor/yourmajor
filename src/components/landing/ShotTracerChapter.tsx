'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Chapter 3 — the shot tracer. A textured vector aerial of a par 5 at
 * dusk, drawn entirely from the marketing tokens (every color is a
 * color-mix of tokens; the grain is SVG turbulence), with ONE continuous
 * tee-to-hole tracer over it. The section never pins: when it enters the
 * viewport the trace draws itself in about two seconds — the house
 * dashoffset-proxy pattern from HeroSection, the ball riding the tip via
 * getPointAtLength — while the data rail brightens shot by shot alongside.
 * Leaving upward resets it, so scrolling back replays the shot.
 *
 * Static renditions (mobile, reduced motion, no JS) show the finished hole:
 * tracer drawn, ball at the hole, full data rail. The entrance only ever
 * winds that picture back, so nothing is gated behind it.
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

/* One continuous tee-to-hole line in the aerial's coordinate space
   (1024x1536) — the same corridor the old five flights traced, joined
   into a single stroke from the tee box to the flag. */
const TRACE =
  'M 505 1300 C 560 1120, 560 985, 520 850 C 478 745, 468 655, 505 560 ' +
  'C 548 455, 556 320, 522 205 C 528 178, 533 148, 537 131'

const HOLE = { x: 537, y: 131 }

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
          const flight = svg.querySelector<SVGPathElement>('[data-flight]')
          const rows = gsap.utils.toArray<HTMLElement>('[data-shot]', rail)
          const result = rail.querySelector<HTMLElement>('[data-result]')
          if (!ball || !flight || rows.length !== SHOTS.length || !result) return

          // Wind the finished picture back: undrawn trace, hidden ball,
          // dimmed rows. All context-tracked, so media.revert restores the
          // static rest state.
          gsap.set(rows, { opacity: 0.35, x: -6 })
          gsap.set(result, { opacity: 0, y: 8 })
          gsap.set(ball, { opacity: 0 })
          flight.style.strokeDashoffset = '1'
          const len = flight.getTotalLength()

          // The shot plays itself when the section arrives; leaving upward
          // resets it, so scrolling back replays. Never pins.
          const draw = { v: 1 }
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 60%',
              toggleActions: 'play none none reset',
            },
          })
          tl.to(ball, { opacity: 1, ease: 'power2.in', duration: 0.12 }, 0.1)
          tl.to(
            draw,
            {
              v: 0,
              ease: 'power2.inOut',
              duration: 1.8,
              onUpdate: () => {
                flight.style.strokeDashoffset = String(draw.v)
                const tip = flight.getPointAtLength((1 - draw.v) * len)
                gsap.set(ball, { attr: { cx: tip.x, cy: tip.y } })
              },
            },
            0.1,
          )
          // The rail brightens shot by shot alongside the draw.
          tl.to(
            rows,
            { opacity: 1, x: 0, ease: 'power2.out', duration: 0.3, stagger: 0.28 },
            0.25,
          )
          // The drop: a small pop as the ball reaches the hole.
          tl.to(ball, { scale: 1.6, transformOrigin: '50% 50%', ease: 'power2.out', duration: 0.12 }, 1.92)
          tl.to(ball, { scale: 1, ease: 'power2.in', duration: 0.16 }, 2.04)
          tl.to(result, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.32 }, 2.0)

          return () => {
            // Untracked writes from onUpdate: restore the static picture.
            flight.style.strokeDashoffset = ''
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
                  className="mk-label"
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
                aria-label="Aerial view of a par five with the shot traced from tee to hole"
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
                  {/* The tracer warms from bone at the tee into gold at the
                      flag — the page's one sanctioned gold line grammar. */}
                  <linearGradient
                    id="tr-trace"
                    gradientUnits="userSpaceOnUse"
                    x1="505"
                    y1="1300"
                    x2="537"
                    y2="131"
                  >
                    <stop offset="0" stopColor="var(--mk-bone)" stopOpacity="0.85" />
                    <stop offset="0.72" stopColor="var(--mk-bone)" />
                    <stop offset="1" stopColor="var(--mk-gold)" />
                  </linearGradient>
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

                {/* The trace. Static default is fully drawn (dashoffset 0
                    attribute); the entrance winds it back via inline style. */}
                <path
                  data-flight
                  d={TRACE}
                  pathLength="1"
                  strokeDasharray="1"
                  strokeDashoffset="0"
                  fill="none"
                  stroke="url(#tr-trace)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity="0.95"
                />

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
