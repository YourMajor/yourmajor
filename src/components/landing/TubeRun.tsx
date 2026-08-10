'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { useGSAP } from '@gsap/react'
import { GolfBall, GolfBallDefs } from './GolfBall'

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, useGSAP)

/**
 * The worm tube, after gsap.com/scroll — and the page's one cup.
 *
 * A flagged hole sits on the right. A volley of golf balls rains into it as
 * the visitor arrives; two of them come back out of that same cup, roll the
 * switchbacks, and the tube sweeps down and left under the copy to resolve
 * into a second hole at the bottom left. One hole, one story, one
 * coordinate space — the drop and the run used to be separate sections with
 * separate cups, which is why they never lined up.
 *
 * The tube is translucent so the sunset photograph reads through it.
 *
 * Every extent is inside the viewBox on purpose — the stroke reaches
 * TUBE_W/2 past the centerline and the round caps another TUBE_W/2 past
 * each endpoint, and an SVG clips whatever crosses its viewport.
 *
 * Rest state (mobile, reduced motion, no JS): the flagged cup, the empty
 * tube and the exit hole. Every ball is hidden in CSS; GSAP only winds away
 * from that.
 */

// The viewBox reaches above the origin to give the volley its runway.
const VB = { x: 0, y: -800, w: 2000, h: 2100 }
const TUBE_W = 131
const BALL_R = 50 // diameter ≈ 76% of the bore, like theirs

const CUP = { x: 1700, y: 90 } // the flagged hole: balls in, then two back out
const EXIT = { x: 320, y: 1215 } // where the run resolves, bottom left under the copy

// The visible tube: mouth to mouth.
const TUBE =
  'M 1700 210 L 1700 260 C 1700 310, 1660 360, 1600 360 ' +
  'L 1250 360 A 100 100 0 0 0 1250 560 ' +
  'L 1700 560 A 100 100 0 0 1 1700 760 ' +
  'L 1300 760 C 1200 760, 1150 820, 1150 900 ' +
  'C 1150 990, 1060 1050, 960 1050 ' +
  'L 420 1050 C 360 1050, 320 1090, 320 1120'

// What the two travelling balls follow: the same run, extended at both ends
// so a single motion-path tween carries each from inside the cup to inside
// the exit hole. One tween per ball, no chaining and no relative values —
// relative offsets recorded on first render are exactly what made a
// scrubbed ball drop twice and fly off on the way back up.
const TRAVEL = `M ${CUP.x} ${CUP.y} ${TUBE.slice(TUBE.indexOf('L'))} L ${EXIT.x} ${EXIT.y}`

// Where each ball of the volley hangs at progress 0, relative to the cup.
// Where the volley lies scattered across the green before the scroll draws
// it in, as offsets from the cup. All six are visible the whole time the
// section is on screen, so this is a composition, not a queue.
//
// Every value stays inside the viewBox — an SVG clips whatever leaves it,
// and a ball whose scatter point is outside simply never appears.
// Every one sits ABOVE the cup: a ball drawn in from below would rise up
// through the oval, and a ball that has not finished sinking would show
// beneath the lip.
const RAIN = [
  { dx: -1280, dy: -560, spin: -120 },
  { dx: -840, dy: -300, spin: -70 },
  { dx: -400, dy: -640, spin: 110 },
  { dx: -1450, dy: -200, spin: -95 },
  { dx: -720, dy: -430, spin: 80 },
  { dx: 200, dy: -520, spin: 130 },
]

// Vertical gradient bands: each run's span shades light -> dark. Runs sit
// at y 360 / 560 / 760 / 1050 with the stroke reaching ±66.
const BANDS = [
  [294, 426],
  [494, 626],
  [694, 826],
  [984, 1116],
]

export function TubeRun() {
  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        () => {
          const root = rootRef.current
          const travel = root?.querySelector<SVGPathElement>('[data-tube-travel]')
          const rain = gsap.utils.toArray<SVGGElement>('[data-rain]', root)
          const balls = gsap.utils.toArray<SVGGElement>('[data-ball]', root)
          if (!root || !travel || !balls.length) return

          const spin = (travel.getTotalLength() / (Math.PI * BALL_R * 2)) * 360
          const RUN = 0.7 // each travelling ball's share of the timeline

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: root.querySelector('[data-tube-figure]'),
              // Ends while the figure is still on screen: run it to the
              // figure's bottom and the last ball only reaches the cup
              // after the whole thing has scrolled past.
              start: 'top 85%',
              end: 'bottom 70%',
              scrub: 2,
              invalidateOnRefresh: true,
            },
          })

          // The volley. A `set` at position 0 (not a fromTo) puts all six on
          // the green from the first frame of the scrub, so the visitor
          // arrives to a scattered composition rather than watching balls
          // wink into existence one at a time.
          rain.forEach((ball, i) => {
            const { dx, dy, spin: rot } = RAIN[i]
            // The scatter is baked into each ball's own coordinates, so all
            // six are simply on the green from the moment the section is on
            // screen — no timeline state required to make them appear.
            // GSAP only ever draws them from there into the cup.
            const at = 0.04 + i * 0.03
            tl.to(
              ball,
              {
                x: -dx,
                y: -dy,
                rotation: rot,
                transformOrigin: '50% 50%',
                ease: 'power2.in',
                duration: 0.28,
              },
              at,
            )
            tl.to(ball, { scale: 0.3, autoAlpha: 0, ease: 'power1.in', duration: 0.06 }, at + 0.28)
          })

          // Two of them come back out of the same cup and take the tube.
          balls.forEach((ball, i) => {
            const at = 0.4 + i * 0.14
            // One deterministic tween for the whole journey: motionPath
            // start/end are absolute progress along the path, so every
            // frame is the same whichever direction the scrub runs.
            tl.to(
              ball,
              {
                motionPath: {
                  path: travel,
                  align: travel,
                  alignOrigin: [0.5, 0.5],
                  start: 0,
                  end: 1,
                },
                ease: 'none',
                duration: RUN,
              },
              at,
            )
            tl.to(ball, { rotation: spin, ease: 'none', duration: RUN }, at)
            tl.fromTo(
              ball,
              { autoAlpha: 0, scale: 0.4 },
              { autoAlpha: 1, scale: 1, ease: 'power1.out', duration: 0.05, immediateRender: false },
              at,
            )
            tl.to(
              ball,
              { scale: 0.3, autoAlpha: 0, ease: 'power1.in', duration: 0.06 },
              at + RUN - 0.06,
            )
          })
          tl.to({}, { duration: 0.04 })

          // The poster's press-register, which lives in this same section
          // and used to run on CSS `animation-timeline: view()`. That is
          // dead under ScrollSmoother — the smoother transforms
          // #smooth-content, and a view() timeline reads the untransformed
          // layout, so the ink froze at its fully misregistered start.
          const ink = root.parentElement?.querySelector<HTMLElement>('.mk-poster-ink')
          if (ink) {
            gsap.fromTo(
              ink,
              { x: 18, y: 18 },
              {
                x: 3,
                y: 3,
                ease: 'none',
                scrollTrigger: { trigger: ink, start: 'top 85%', end: 'top 35%', scrub: 1 },
              },
            )
          }
        },
      )
      return () => media.revert()
    },
    { scope: rootRef },
  )

  return (
    // Spans the container: the switchbacks sit to the right of the copy and
    // the closing sweep runs left underneath it. The container's right edge
    // is as far right as this can go — the fixed Front Nine rail lives just
    // outside it (>=1440px), and any further slides the tube under the
    // rail, which reads as the tube being cut off.
    <div
      ref={rootRef}
      aria-hidden
      className="mk-tube-run pointer-events-none absolute hidden lg:block"
      style={{
        left: 'max(3vw, calc((100vw - var(--mk-container)) / 2))',
        right: 'max(3vw, calc((100vw - var(--mk-container)) / 2))',
        // The section reserves its own headroom (pt-[20rem]) for the flag,
        // rather than the figure reaching up into the hero above it.
        top: '2rem',
      }}
    >
      <svg
        data-tube-figure
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        className="block w-full"
      >
        <defs>
          <linearGradient id="mk-worm-shade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="1300">
            {BANDS.map(([top, bottom]) => [
              <stop
                key={`${top}a`}
                offset={top / 1300}
                stopColor="color-mix(in oklab, var(--mk-green-raised) 52%, var(--mk-bone))"
              />,
              <stop
                key={`${bottom}b`}
                offset={bottom / 1300}
                stopColor="color-mix(in oklab, var(--mk-cup) 78%, var(--mk-green-raised))"
              />,
            ])}
          </linearGradient>
          {/* Flag cloth: lit at the pole, shading toward the fly end. */}
          <linearGradient id="mk-worm-flag" gradientUnits="userSpaceOnUse" x1={CUP.x} y1="0" x2={CUP.x - 150} y2="0">
            <stop offset="0" stopColor="var(--mk-bone-bright)" />
            <stop offset="0.55" stopColor="var(--mk-bone)" />
            <stop offset="1" stopColor="color-mix(in oklab, var(--mk-bone) 80%, var(--mk-green-deep))" />
          </linearGradient>
          {/* Offset + blur, never a flat halo: the tube has to sit above
              the photograph rather than lie flat on it. */}
          <filter id="mk-worm-lift" x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow
              dx="0"
              dy="18"
              stdDeviation="26"
              floodColor="var(--mk-cup)"
              floodOpacity="0.4"
            />
          </filter>
          <GolfBallDefs id="mk-worm-ball" r={BALL_R} />
        </defs>

        {/* The flagstick over the cup, and its waving pennant. */}
        <line
          x1={CUP.x}
          y1={CUP.y}
          x2={CUP.x}
          y2={CUP.y - 700}
          stroke="var(--mk-gold)"
          strokeWidth="7"
        />
        <circle cx={CUP.x} cy={CUP.y - 704} r="12" fill="var(--mk-gold)" />
        <path
          d={`M ${CUP.x} ${CUP.y - 694}
              C ${CUP.x - 58} ${CUP.y - 706}, ${CUP.x - 104} ${CUP.y - 674}, ${CUP.x - 156} ${CUP.y - 690}
              C ${CUP.x - 178} ${CUP.y - 697}, ${CUP.x - 198} ${CUP.y - 685}, ${CUP.x - 208} ${CUP.y - 667}
              C ${CUP.x - 187} ${CUP.y - 654}, ${CUP.x - 164} ${CUP.y - 661}, ${CUP.x - 143} ${CUP.y - 646}
              C ${CUP.x - 94} ${CUP.y - 622}, ${CUP.x - 46} ${CUP.y - 641}, ${CUP.x} ${CUP.y - 616} Z`}
          fill="url(#mk-worm-flag)"
        />

        {/* The tube. Translucent so the sunset reads through the bore. */}
        <path
          d={TUBE}
          fill="none"
          stroke="url(#mk-worm-shade)"
          strokeWidth={TUBE_W}
          strokeLinecap="round"
          strokeOpacity="0.76"
          filter="url(#mk-worm-lift)"
        />
        {/* The travel line is geometry only, never painted. */}
        <path data-tube-travel d={TRAVEL} fill="none" stroke="none" />

        {/* The volley that rains into the cup, then the two that come back
            out and take the tube. All hidden at rest (CSS). */}
        {/* Home position is baked into the ball's own coordinates, never a
            transform attribute on the group: GSAP owns that attribute and
            overwrites it, which flung the whole volley off to the left. */}
        {RAIN.map((ball, i) => (
          <g key={`rain-${i}`} data-rain>
            <GolfBall
              defsId="mk-worm-ball"
              cx={CUP.x + ball.dx}
              cy={CUP.y + ball.dy}
              r={BALL_R}
            />
          </g>
        ))}
        {[0, 1].map((i) => (
          <g key={i} data-ball>
            <GolfBall defsId="mk-worm-ball" cx={0} cy={0} r={BALL_R} />
          </g>
        ))}

        {/* The cup itself, and the hole the run resolves into. Drawn last so
            a ball sinking into either passes behind the lip. */}
        <ellipse cx={CUP.x} cy={CUP.y} rx="135" ry="12" fill="var(--mk-cup)" />
        <ellipse cx={EXIT.x} cy={EXIT.y} rx="135" ry="12" fill="var(--mk-cup)" />
      </svg>
    </div>
  )
}
