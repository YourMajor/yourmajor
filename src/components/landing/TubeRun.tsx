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
const CUP_RX = 135
const CUP_RY = 12
// How far past the lip a ball travels before the throat mask has eaten all
// of it: r plus a margin, so the last frame is empty rather than a sliver.
const SINK = BALL_R + 24

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
// The last leg runs SINK past the exit's centre, not to it: the throat mask
// there swallows the ball as it descends, which is what makes it drop into
// the hole instead of shrinking on top of it.
const TRAVEL = `M ${CUP.x} ${CUP.y} ${TUBE.slice(TUBE.indexOf('L'))} L ${EXIT.x} ${EXIT.y + SINK}`

// Where each ball of the volley hangs at progress 0, relative to the cup.
// Where the volley lies scattered across the green before the scroll draws
// it in, as offsets from the cup. All six are visible the whole time the
// section is on screen, so this is a composition, not a queue.
//
// Every value stays inside the viewBox — an SVG clips whatever leaves it,
// and a ball whose scatter point is outside simply never appears.
// Every one sits ABOVE the cup: a ball drawn in from below would rise up
// through the oval.
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
            // And down the hole. It used to shrink and fade on the spot at
            // the cup's centre, which left the bottom third of a 100px ball
            // sitting below a 24px lip for the whole fade. Now it keeps
            // falling and mk-cup-mask eats it on the way. Absolute y, never
            // relative — relative offsets recorded on first render are the
            // exact thing that made a scrubbed ball drop twice.
            tl.to(
              ball,
              { y: -dy + SINK, ease: 'power2.in', duration: 0.1 },
              at + 0.28,
            )
            // Insurance for the far side of the scrub: the mask has already
            // hidden it, this only guarantees a clean state to wind back from.
            tl.set(ball, { autoAlpha: 0 }, at + 0.38)
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
            // No scale-down at the exit either: TRAVEL now runs SINK past
            // the hole's centre and mk-exit-mask does the swallowing.
            tl.set(ball, { autoAlpha: 0 }, at + RUN)
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

          {/* The throats. Paint order alone could never hide a sinking ball:
              the lip is a 24px-tall ellipse, the ball is 100px across, and
              this SVG is transparent over the poster photograph, so the
              belly hanging below the rim painted straight onto the picture.
              An opaque occluder is not available for the same reason — it
              would read as a dark slab on the photo.

              So each hole subtracts its own interior from a full-viewBox
              white field: sweep-flag 0 walks the ellipse's LOWER arc (SVG's
              y grows downward), then the shape drops away below. A ball
              crossing that arc is eaten by the front lip exactly as it would
              be by a real one, and the mask is bounded to the hole's own
              footprint, so a ball still flying in several hundred units to
              the left is untouched. */}
          {([['mk-cup-mask', CUP], ['mk-exit-mask', EXIT]] as const).map(([id, c]) => (
            <mask
              key={id}
              id={id}
              maskUnits="userSpaceOnUse"
              x={VB.x}
              y={VB.y}
              width={VB.w}
              height={VB.h}
            >
              <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="white" />
              <path
                d={`M ${c.x - CUP_RX} ${c.y}
                    A ${CUP_RX} ${CUP_RY} 0 0 0 ${c.x + CUP_RX} ${c.y}
                    L ${c.x + CUP_RX} ${c.y + 400}
                    L ${c.x - CUP_RX} ${c.y + 400} Z`}
                fill="black"
              />
            </mask>
          ))}
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
        {/* The mask goes on a static wrapper, never on the animated group:
            a mask resolves in its own element's post-transform user space,
            so on the ball itself it would travel along with it and clip
            nothing. The volley falls into CUP, so it wears that throat. */}
        <g mask="url(#mk-cup-mask)">
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
        </g>
        {/* The two travellers wear the EXIT throat only. They emerge from
            CUP and are meant to be visible in the gap between its lip and
            the tube mouth at y=210; masking them there would erase it. */}
        <g mask="url(#mk-exit-mask)">
          {[0, 1].map((i) => (
            <g key={i} data-ball>
              <GolfBall defsId="mk-worm-ball" cx={0} cy={0} r={BALL_R} />
            </g>
          ))}
        </g>

        {/* The cup itself, and the hole the run resolves into. Drawn last so
            the rim reads in front of whatever is still above it; the throat
            masks above are what actually swallow a sinking ball. */}
        <ellipse cx={CUP.x} cy={CUP.y} rx={CUP_RX} ry={CUP_RY} fill="var(--mk-cup)" />
        <ellipse cx={EXIT.x} cy={EXIT.y} rx={CUP_RX} ry={CUP_RY} fill="var(--mk-cup)" />
      </svg>
    </div>
  )
}
