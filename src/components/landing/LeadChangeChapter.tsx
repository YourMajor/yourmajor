'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import boardCourse from '../../../public/images/marketing/board-course.png'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { LeaderboardPlate, ROUND_STATES, scoreColor } from './LeaderboardPlate'
import { SplitFlapStatus } from './SplitFlapStatus'
import { TubeRunLead } from './TubeRunLead'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Chapter 2 — the lead change. The board pins for ~150vh and plays the last
 * six holes as the visitor scrolls: Palmer leads through 12, the lead shrinks
 * to one at 17, Watson takes it at the last. A copy rail on the left advances
 * with the round state so the visitor reads the story the board is telling.
 *
 * Desktop-and-full-motion only, exactly like every pin on this surface. On
 * mobile and under reduced motion the chapter renders static: the three beats
 * stacked as copy, the live board beside them, nothing missing.
 */

/* One term for one concept: the chip and the split-flap above the board both
   render this string, and the board's own column is headed THRU. "Hole 17"
   was the odd one out. "Final" stays — that is the board's word for a
   finished round, not a hole count. */
const BEATS = [
  { thru: 'Thru 12', line: 'Palmer is six clear and cruising.' },
  { thru: 'Thru 17', line: 'Two birdies back. The lead is one.' },
  { thru: 'Final', line: 'Watson takes it by one.' },
]

/* `instant` restores a state synchronously with no tweens: the breakpoint
   cleanup uses it to put the rest-state figures back, since clearing
   transforms alone would leave the final round's text in rest-state row
   order and mis-sort the board. */
function paintBoard(plate: HTMLElement, stateIndex: number, instant = false) {
  const state = ROUND_STATES[stateIndex]
  const rows = plate.querySelectorAll<HTMLElement>('[data-row]')
  if (!state || rows.length !== state.length) return

  const step = rows.length > 1 ? rows[1].offsetTop - rows[0].offsetTop : 0

  state.forEach((cell, i) => {
    const row = rows[i]
    const write = (name: string, value: string, color?: string) => {
      const node = row.querySelector<HTMLElement>(`[data-cell="${name}"]`)
      if (!node) return
      if (instant) {
        gsap.killTweensOf(node)
        gsap.set(node, { clearProps: 'transform,opacity' })
        node.textContent = value
        if (color) node.style.color = color
        return
      }
      if (node.textContent !== value) {
        node.textContent = value
        if (color) node.style.color = color
        // The tick: a changed figure rises into place, broadcast style.
        gsap.fromTo(node, { y: 5, opacity: 0.2 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
      }
    }

    write('pos', cell.pos)
    write('today', cell.today, scoreColor(cell.today))
    write('thru', cell.thru)
    write('total', cell.total, scoreColor(cell.total))

    if (instant) {
      gsap.killTweensOf(row)
      gsap.set(row, { clearProps: 'transform' })
      return
    }
    gsap.to(row, {
      y: (cell.slot - i) * step,
      duration: 0.45,
      ease: 'power2.inOut',
      overwrite: 'auto',
    })
  })
}

export function LeadChangeChapter() {
  const sectionRef = useRef<HTMLElement>(null)
  const plateRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  // Drives the split-flap readout above the board; paint() advances it.
  const [beatIndex, setBeatIndex] = useState(0)

  useGSAP(
    () => {
      const media = gsap.matchMedia()

      media.add(
        '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        () => {
          const plate = plateRef.current
          const rail = railRef.current
          if (!plate || !rail) return

          const beats = rail.querySelectorAll<HTMLElement>('[data-beat]')

          // Idempotent paint keyed off progress rather than timeline
          // callbacks: a fast scrub can skip a callback, never this.
          let painted = -1
          const paint = (index: number) => {
            if (index === painted) return
            painted = index
            paintBoard(plate, index)
            setBeatIndex(index)
            beats.forEach((beat, i) => {
              // is-on retypes the active chip (see .mk-chip in globals.css).
              beat.classList.toggle('is-on', i === index)
              gsap.to(beat, {
                opacity: i === index ? 1 : 0.32,
                x: i === index ? 0 : -6,
                duration: 0.35,
                ease: 'power2.out',
                overwrite: 'auto',
              })
            })
            // The overtake: when the final state lands, the row that takes
            // the lead flashes gold as it settles into the top slot.
            const rows = plate.querySelectorAll<HTMLElement>('[data-row]')
            rows.forEach((row) => row.classList.remove('mk-row-flash'))
            if (index === 2) {
              const winner = ROUND_STATES[2].findIndex((cell) => cell.slot === 0)
              rows[winner]?.classList.add('mk-row-flash')
            }
          }

          const trigger = ScrollTrigger.create({
            trigger: sectionRef.current,
            start: 'top top',
            // 150%, not 50%. TubeRunLead plays its whole run inside this pin
            // and its speed is matched to the first leg's (2.67px of ball per
            // px of scroll); at 50% the balls crossed three times too fast.
            // These two ranges are one number in two files — change this and
            // TubeRunLead's `end` moves with it, or the run finishes after the
            // board has already let go.
            end: '+=150%',
            pin: true,
            scrub: true,
            // The paint is discrete (three board states), so when scrolling
            // stops mid-beat the board settles onto the nearest state
            // instead of resting between rounds. Values are zone centers of
            // the thresholds below.
            snap: {
              snapTo: [0.17, 0.52, 0.85],
              duration: 0.4,
              delay: 0.1,
              ease: 'power1.inOut',
            },
            onUpdate: (self) => {
              paint(self.progress < 0.34 ? 0 : self.progress < 0.7 ? 1 : 2)
            },
          })

          paint(0)

          return () => {
            trigger.kill()
            plate
              .querySelectorAll('[data-row]')
              .forEach((row) => row.classList.remove('mk-row-flash'))
            beats.forEach((beat) => beat.classList.remove('is-on'))
            // Repaint the rest state instantly: text and colors, not just
            // transforms, or the static board below the breakpoint keeps the
            // final round's figures in rest-state order.
            paintBoard(plate, 0, true)
            setBeatIndex(0)
            gsap.set(beats, { clearProps: 'all' })
          }
        },
      )

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    // min-h is lg-only: the full-viewport floor exists so the pin has a
    // stage, and the pin is gated to lg. Below it the board is static and
    // the section only needs the height its own content asks for.
    <section
      ref={sectionRef}
      id="lead"
      className="relative flex items-center lg:min-h-[100dvh]"
    >
      {/* Dusk ground for the chapter, on the same drop-in contract the hero
          and the poster use: masked at both ends so the page green runs into
          it and out of it with no seam. No overflow clip — the pin spacer
          this section creates at lg would inherit it. */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 86%, transparent 100%)',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 86%, transparent 100%)',
        }}
      >
        <Image
          src={boardCourse}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          placeholder="blur"
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'color-mix(in oklch, var(--mk-green-deep) 52%, transparent)',
          }}
        />
      </div>

      {/* Tight on a phone: this chapter arrives before the features run and
          before any section heading that frames it, so it must not read as
          the whole screen on the way past. Desktop rhythm is unchanged.

          The lg padding is what centres the whole composition — board AND
          tube — while the chapter is pinned, rather than centring the board
          alone and letting the run hang off the bottom. The tube is a child
          of this box now, so it moves with it; the box is deliberately taller
          than the board (192 above, 340 below) so that its midpoint is the
          RUN's midpoint, not the board's. Change either number and the run
          stops being centred: pb must stay ≈ pt + 148. */}
      <div className="mk-container relative w-full py-6 lg:pt-48 lg:pb-[21.25rem]">
        {/* The run's second leg. Mounted between the ground and the board so
            it passes over the course and behind the plate without needing a
            z-index — none of the three makes a stacking context. It overflows
            this box at both ends by design; nothing here clips. */}
        <TubeRunLead />
        {/* The studio band: the chapter mounts on a deep-green panel framed by
            a gold hairline. Live-accepted variant with params baked: deep
            tone, gold at 45% (chip borders at 90%). Slightly translucent now
            so the photograph reads as the ground it is sitting on. */}
        {/* 80% at lg, centred: that leaves a ~123px channel down each side,
            which is what the tube run needs to pass the board rather than
            vanish behind it for 780 of its 1980 units. Full width below lg,
            where the tube does not ship at all. */}
        {/* `relative` is load-bearing: the tube beside it is absolutely
            positioned, and a positioned element paints above a non-positioned
            in-flow sibling whatever the DOM order says. Without this the run
            renders on top of the board instead of behind it. */}
        <div
          className="relative lg:mx-auto lg:w-4/5"
          style={{
            background: 'color-mix(in oklch, var(--mk-green-deep) 90%, transparent)',
            border: '1px solid color-mix(in oklch, var(--mk-gold) 45%, transparent)',
            borderRadius: 'var(--mk-radius-lg)',
            // Trimmed from 3.5rem. While this chapter is pinned the board is
            // the only thing between the tube's two holes, and at 494px of a
            // 950px viewport it left the run no vertical room to bend in.
            padding: 'clamp(1.25rem, 3vw, 2rem)',
            boxShadow: 'var(--mk-shadow-plate)',
          }}
        >
          <div className="grid items-center gap-7 lg:grid-cols-12 lg:gap-10">
            <div ref={railRef} className="lg:col-span-5">
              <h2>Live to the last putt</h2>
              <div className="mt-6 space-y-4 lg:mt-8 lg:space-y-5">
                {BEATS.map((beat) => (
                  <div key={beat.thru} data-beat>
                    <span
                      className="mk-chip mk-data inline-flex items-center text-sm"
                      style={{
                        padding: '0.2rem 0.65rem',
                        border: '1px solid color-mix(in oklch, var(--mk-gold) 90%, transparent)',
                        borderRadius: 'var(--mk-radius-sm)',
                        color: 'var(--mk-gold)',
                      }}
                    >
                      {beat.thru}
                    </span>
                    <p
                      className="mt-2 text-base leading-relaxed lg:text-xl"
                      style={{ color: 'var(--mk-text)' }}
                    >
                      {beat.line}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div ref={plateRef} className="lg:col-span-7">
              {/* The board's clock: flips with the beats, holds "Thru 12"
                  wherever the chapter renders static. */}
              <div className="mb-3 flex justify-end">
                <SplitFlapStatus value={BEATS[beatIndex].thru} />
              </div>
              <LeaderboardPlate />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
