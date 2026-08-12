'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { useGSAP } from '@gsap/react'
import { GolfBall, GolfBallDefs } from './GolfBall'

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, useGSAP)

/**
 * The run's second leg. The first (TubeRun, inside PosterInterstitial) ends
 * by dropping two balls into a hole at its bottom left; this one has them
 * come back out of a hole below the clubhouse band, take a longer set of
 * switchbacks down past the lead-change board, and hole out again directly
 * above "How a round gets scored".
 *
 * Same gauge as the first leg on purpose — TUBE_W, BALL_R and the cup
 * ellipse are identical, and the viewBox is 2000 wide like the first, so a
 * 131-unit stroke renders at exactly the same pixel width in the same
 * container. Only the canvas is taller (2580 rather than 2100), because this
 * leg spans a much taller stretch of page.
 *
 * Every id here is suffixed `2`: SVG ids are document-global, and reusing
 * the first leg's gradient and filter ids would have both figures resolve to
 * whichever mounted last.
 *
 * Mounted inside LeadChangeChapter, after its photographic ground and before
 * its content, so the tube passes over the course and behind the board plate
 * with no z-index needed — none of those elements makes a stacking context.
 * It overflows the section at both ends by design; the section carries no
 * overflow clip.
 *
 * Rest state (mobile, reduced motion, no JS): the two holes and the empty
 * tube. Both balls are hidden by CSS (.mk-tube-run [data-ball]); GSAP only
 * ever winds away from that.
 */

// The canvas is sized against the POST-PIN layout, not the resting one.
// LeadChangeChapter pins with pinType 'transform' (ScrollSmoother forces it),
// so once the pin has played out the section — and this figure inside it —
// sits translated 475px down its spacer for good. The start hole is only ever
// seen before the pin engages, where the translate is 0; the end hole is only
// ever seen after it, where the translate is at full. So the run is cut ~740
// viewBox units short of the raw distance, and both holes land where they
// should at the moment they are actually on screen.
const VB = { x: 0, y: 0, w: 2000, h: 1650 }
const TUBE_W = 131
const BALL_R = 50
const CUP_RX = 135
const CUP_RY = 12
// Far enough past the lip that the throat mask has eaten the whole ball.
const SINK = BALL_R + 24

// Both holes are placed against the PINNED viewport, not the page. While the
// chapter is pinned the section's top sits at viewport 0, so this figure —
// offset -7rem above it — maps viewBox y to viewport y as (y * 0.6325) - 112
// at the container's design width. The sticky nav eats the first 80px and the
// fold is at 950, which leaves 304 < y < 1679. Both cups sit inside that, so
// the whole run is on screen for the entire time the board is held.
// Raised as far as the sticky nav allows — the cup's lip lands at viewport 74
// against a 58px bar — to open 166 units of air between it and the bore. The
// mouth cannot come down to meet it (the board would swallow it), so this is
// the whole budget for the fall.
const START = { x: 300, y: 285 }
const END = { x: 1660, y: 1560 } // viewport ~875: clear of the fold at 950

// Mouth to mouth. Radius-110 semicircles over 220-unit spans, the same
// vocabulary as the first leg's radius-100 turns; every extent stays inside
// the viewBox, since the stroke reaches TUBE_W/2 past the centreline and the
// round caps another TUBE_W/2 past each endpoint.
//
// Measured, not guessed: the board plate occupies y 481-1186 of this canvas,
// and x 221-1779 now that it is 80% wide at lg. Those bounds are fixed —
// LeadChangeChapter anchors the board 192px from its own top rather than
// centring it in a viewport-height section, so they do not drift with the
// window. That leaves two channels — x < 221 and x > 1779 — and they are
// where the run is spent, because they are the only part of the board's
// 705-unit band a visitor can see.
//
// The weave is three descents and two crossings: left channel, behind the
// board, right channel, behind the board, left channel, then out below. The
// crossings are hidden, but the tube entering and leaving each channel at a
// different height is what reads as a weave rather than a single sweep.
//
// The vertical runs sit at x 120 and 1880 — the channel centres. Each carries
// a 131-wide stroke (±66), clearing the plate edge by 35 units on the inside
// and the viewBox by 54 on the outside.
// One cubic off the mouth rather than two: a pair of short curves inside a
// 131-wide stroke overlap their own casing and render as a blob instead of a
// bend. Every control point here keeps the path monotonic in y.
// The bore's top end, and it cannot move down: the board starts at y 475, so
// a mouth any lower begins behind it. The open air under the hole is bought
// by raising the cup instead — see START.
const MOUTH = { x: 300, y: 463 }
// Where a ball is first drawn: below the cup's front lip, never on it. Centred
// on the cup it straddled the ellipse — top dome above the rim, belly below —
// which reads as a ball skewered on the hole rather than one coming out of it.
// r + 18 leaves its top edge 6 units clear of the lip: as close under the hole
// as it can start without touching it.
const DROP = { x: START.x, y: START.y + BALL_R + 18 }
const TUBE =
  `M ${MOUTH.x} ${MOUTH.y} C 300 590, 120 610, 120 690 ` +
  'L 120 800 C 120 865, 175 900, 250 900 ' +
  'L 1690 900 C 1790 900, 1880 950, 1880 1015 ' +
  'L 1880 1080 C 1880 1130, 1820 1140, 1745 1140 ' +
  'L 260 1140 C 160 1140, 120 1190, 120 1250 ' +
  'C 120 1320, 180 1360, 260 1360 ' +
  'L 1500 1360 C 1600 1360, 1660 1400, 1660 1440'

// One deterministic tween carries each ball from below the start hole to
// inside the end one: the tube extended at both ends. No relative values and
// no chaining — relative offsets recorded on first render are exactly what
// makes a scrubbed ball drop twice and fly off on the way back up.
//
// Sliced at the first CURVE, not the first `L`. The first leg's tube opens
// `M x y L x y C …` so slicing at 'L' dropped only its own M; this one opens
// `M x y C …`, and slicing at 'L' threw away the mouth curve as well — the
// ball cut a straight diagonal from the hole to the first switchback instead
// of following the bore. Anchor on the shape's own first command.
const TRAVEL =
  `M ${DROP.x} ${DROP.y} L ${MOUTH.x} ${MOUTH.y} ` +
  `${TUBE.slice(TUBE.indexOf('C'))} L ${END.x} ${END.y + SINK}`

// Vertical gradient bands: each horizontal run shades light -> dark. The runs
// sit at y 900 / 1140 / 1360 with the stroke reaching ±66. The three vertical
// descents cross the bands rather than sitting in one, which is what gives
// them their length-wise shading.
const BANDS = [
  [834, 966],
  [1074, 1206],
  [1294, 1426],
]
const SPAN = 1500

export function TubeRunLead() {
  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        () => {
          const root = rootRef.current
          const travel = root?.querySelector<SVGPathElement>('[data-tube-travel]')
          const balls = gsap.utils.toArray<SVGGElement>('[data-ball]', root)
          if (!root || !travel || !balls.length) return

          const spin = (travel.getTotalLength() / (Math.PI * BALL_R * 2)) * 360
          const RUN = 0.78 // each ball's share of the timeline

          // The chapter is the trigger, not the figure. This figure sits
          // INSIDE a pinned element, and ScrollTrigger cannot place a trigger
          // that lives inside a pin without being handed `pinnedContainer` —
          // left to itself it measured a start the scroll never reached, and
          // the timeline sat at progress 0 forever, which is why the balls
          // never left the first hole. Triggering off the pinned element
          // itself sidesteps the whole problem.
          //
          // The range is the pin's own range: the run plays out exactly while
          // the board is held, which is the only stretch where both holes are
          // on screen at once. Function form so it re-reads on refresh.
          //
          // 150vh, and it has to stay in step with the pin's `end` in
          // LeadChangeChapter. It is set by matching the first leg's speed:
          // that run covers 2239px of path over 837px of scroll — 2.67px of
          // ball per px of scroll. This path is 3910px, so one ball needs
          // ~1464px of scroll, and at a 0.78 share of the timeline that is a
          // ~1877px range. At 50vh it was 8.03px per px: three times too fast.
          const chapter = root.closest('section')
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: chapter,
              start: 'top top',
              end: () => `+=${window.innerHeight * 1.5}`,
              scrub: 1,
              invalidateOnRefresh: true,
            },
          })

          balls.forEach((ball, i) => {
            const at = i * 0.16
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
            // Out of the hole: it grows into place rather than winking on.
            tl.fromTo(
              ball,
              { autoAlpha: 0, scale: 0.4 },
              { autoAlpha: 1, scale: 1, ease: 'power1.out', duration: 0.05, immediateRender: false },
              at,
            )
            // No scale-down at the end: TRAVEL runs SINK past the hole's
            // centre and the throat mask does the swallowing.
            tl.set(ball, { autoAlpha: 0 }, at + RUN)
          })
          tl.to({}, { duration: 0.06 })
        },
      )
      return () => media.revert()
    },
    { scope: rootRef },
  )

  return (
    // Inset to its parent, which is the chapter's .mk-container: that box is
    // what gets centred while the section is pinned, so anchoring here is
    // what keeps the run and the board locked together at any window height.
    // (It used to be a child of the section and positioned off the viewport,
    // which meant the board floated away from the tube as the window grew.)
    <div
      ref={rootRef}
      aria-hidden
      className="mk-tube-run pointer-events-none absolute inset-x-0 hidden lg:block"
      style={{ top: '-7rem' }}
    >
      <svg
        data-tube-figure
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        className="block w-full"
      >
        <defs>
          <linearGradient
            id="mk-worm2-shade"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="0"
            y2={SPAN}
          >
            {BANDS.map(([top, bottom]) => [
              <stop
                key={`${top}a`}
                offset={top / SPAN}
                stopColor="color-mix(in oklab, var(--mk-green-raised) 52%, var(--mk-bone))"
              />,
              <stop
                key={`${bottom}b`}
                offset={bottom / SPAN}
                stopColor="color-mix(in oklab, var(--mk-cup) 78%, var(--mk-green-raised))"
              />,
            ])}
          </linearGradient>
          {/* Offset + blur, never a flat halo: the tube has to sit above the
              photograph rather than lie flat on it. */}
          <filter id="mk-worm2-lift" x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow
              dx="0"
              dy="18"
              stdDeviation="26"
              floodColor="var(--mk-cup)"
              floodOpacity="0.4"
            />
          </filter>
          <GolfBallDefs id="mk-worm2-ball" r={BALL_R} />

          {/* The end hole's throat, same construction as the first leg's:
              a full-viewBox white field minus the hole's interior, where
              sweep-flag 0 walks the ellipse's LOWER arc (SVG's y grows
              downward) and the shape drops away beneath it. A ball crossing
              that arc is eaten by the front lip instead of hanging its belly
              below a 24-unit ellipse over open photograph. */}
          <mask
            id="mk-exit2-mask"
            maskUnits="userSpaceOnUse"
            x={VB.x}
            y={VB.y}
            width={VB.w}
            height={VB.h}
          >
            <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="white" />
            <path
              d={`M ${END.x - CUP_RX} ${END.y}
                  A ${CUP_RX} ${CUP_RY} 0 0 0 ${END.x + CUP_RX} ${END.y}
                  L ${END.x + CUP_RX} ${END.y + 300}
                  L ${END.x - CUP_RX} ${END.y + 300} Z`}
              fill="black"
            />
          </mask>
        </defs>

        {/* The tube. Translucent so the course reads through the bore. */}
        <path
          d={TUBE}
          fill="none"
          stroke="url(#mk-worm2-shade)"
          strokeWidth={TUBE_W}
          strokeLinecap="round"
          strokeOpacity="0.76"
          filter="url(#mk-worm2-lift)"
        />
        {/* Geometry only, never painted. */}
        <path data-tube-travel d={TRAVEL} fill="none" stroke="none" />

        {/* The two travellers. Masked at the end hole only: they emerge from
            the start hole and are meant to be visible in the gap between its
            lip and the tube mouth. */}
        <g mask="url(#mk-exit2-mask)">
          {[0, 1].map((i) => (
            <g key={i} data-ball>
              <GolfBall defsId="mk-worm2-ball" cx={0} cy={0} r={BALL_R} />
            </g>
          ))}
        </g>

        {/* The holes. Drawn last so each rim reads in front of whatever is
            still above it; the throat mask is what swallows a sinking ball. */}
        <ellipse cx={START.x} cy={START.y} rx={CUP_RX} ry={CUP_RY} fill="var(--mk-cup)" />
        <ellipse cx={END.x} cy={END.y} rx={CUP_RX} ry={CUP_RY} fill="var(--mk-cup)" />
      </svg>
    </div>
  )
}
