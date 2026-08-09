'use client'

import { Fragment, useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

/**
 * A broadcast ticker of the scoring vocabulary the product actually ships:
 * formats and handicap systems, nothing invented. The row rides a gentle
 * wave — a gold hairline drawn a step below the text, the rule as a rolling
 * fairway contour — and loops leftward at the old marquee's tempo. Two row
 * copies are forced to the same arc length with textLength, so the wrap is
 * seamless whatever the font metrics; reduced motion and no-JS hold the
 * resting wave. The SVG is decoration to a screen reader: the terms are
 * read from the visually-hidden list.
 */

const TERMS = [
  'Stroke play',
  'Match play',
  'Scramble',
  'WHS',
  'Stableford',
  'Callaway',
  'Peoria',
  'Gross',
  'Net',
  'Team play',
  'Flights',
  'Seasons',
]

// One row = two passes through the vocabulary, pinned to ROW arc units.
// The natural glyph run is ~2400 units, so textLength only breathes the
// tracking a few percent instead of stretching words apart.
const ROW = 2400
const WAVE_Y = 42
const WAVE_AMP = 14
const VIEW_H = 90

// A periodic wave with a 600-unit wavelength, drawn far past both edges so
// neither the stroke nor the traveling text ever meets a path end on screen.
const WAVE_D = (() => {
  let d = `M -2800 ${WAVE_Y} Q -2650 ${WAVE_Y - WAVE_AMP} -2500 ${WAVE_Y}`
  for (let x = -2200; x <= 5600; x += 300) d += ` T ${x} ${WAVE_Y}`
  return d
})()

export function FormatsMarquee() {
  const sectionRef = useRef<HTMLElement>(null)
  const aRef = useRef<SVGTextPathElement>(null)
  const bRef = useRef<SVGTextPathElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add('(prefers-reduced-motion: no-preference)', () => {
        const a = aRef.current
        const b = bRef.current
        if (!a || !b) return
        const offset = { v: 0 }
        const tween = gsap.to(offset, {
          v: -ROW,
          duration: 36,
          ease: 'none',
          repeat: -1,
          onUpdate: () => {
            a.setAttribute('startOffset', String(offset.v))
            b.setAttribute('startOffset', String(offset.v + ROW))
          },
        })

        // Hover pauses the loop, as the CSS marquee did; pointer devices only.
        const el = sectionRef.current
        if (el && window.matchMedia('(hover: hover)').matches) {
          const pause = () => tween.pause()
          const play = () => tween.play()
          el.addEventListener('pointerenter', pause)
          el.addEventListener('pointerleave', play)
          return () => {
            el.removeEventListener('pointerenter', pause)
            el.removeEventListener('pointerleave', play)
          }
        }
      })
      return () => media.revert()
    },
    { scope: sectionRef },
  )

  const row = TERMS.concat(TERMS).map((term, i) => (
    <Fragment key={`${term}-${i}`}>
      <tspan>{term.toUpperCase()}</tspan>
      {'  '}
      <tspan fill="var(--mk-gold)">·</tspan>
      {'  '}
    </Fragment>
  ))

  return (
    <section
      ref={sectionRef}
      className="mk-rule-soft-t mk-rule-soft-b mt-24 overflow-hidden py-5 lg:mt-32"
      aria-label="Supported formats and handicap systems"
    >
      <p className="sr-only">{TERMS.join(', ')}</p>
      {/* slice, not a fixed width: past 2400px viewports the band scales up
          a few percent to keep covering, instead of leaving a blank strip. */}
      <svg
        aria-hidden
        width="100%"
        height={VIEW_H}
        viewBox={`0 0 ${ROW} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="block"
      >
        <defs>
          <path id="mk-fmt-wave" d={WAVE_D} fill="none" />
        </defs>
        {/* The rule the vocabulary rides: gold, hairline, a step below the
            baseline so descenders never strike through it. */}
        <use
          href="#mk-fmt-wave"
          y="10"
          stroke="var(--mk-gold)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <text className="mk-label" fill="var(--mk-text-subtle)">
          <textPath ref={aRef} href="#mk-fmt-wave" startOffset="0" textLength={ROW} lengthAdjust="spacing">
            {row}
          </textPath>
          <textPath ref={bRef} href="#mk-fmt-wave" startOffset={ROW} textLength={ROW} lengthAdjust="spacing">
            {row}
          </textPath>
        </text>
      </svg>
    </section>
  )
}
