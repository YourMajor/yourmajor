'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { LeaderboardPlate, ROUND_STATES, scoreColor } from './LeaderboardPlate'

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

const BEATS = [
  { thru: 'Thru 12', line: 'Palmer is six clear and cruising.' },
  { thru: 'Hole 17', line: 'Two birdies back. The lead is one.' },
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
            end: '+=70%',
            pin: true,
            scrub: true,
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
            gsap.set(beats, { clearProps: 'all' })
          }
        },
      )

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} id="lead" className="relative flex min-h-[100dvh] items-center">
      <div className="mk-container w-full py-20">
        {/* The studio band: the chapter mounts on a deep-green panel framed by
            a gold hairline. Live-accepted variant with params baked: deep
            tone, gold at 45% (chip borders at 90%). */}
        <div
          style={{
            background: 'var(--mk-green-deep)',
            border: '1px solid color-mix(in oklch, var(--mk-gold) 45%, transparent)',
            borderRadius: 'var(--mk-radius-lg)',
            padding: 'clamp(1.75rem, 4vw, 3.5rem)',
            boxShadow: 'var(--mk-shadow-plate)',
          }}
        >
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
            <div ref={railRef} className="lg:col-span-5">
              <h2>Live to the last putt</h2>
              <div className="mt-10 space-y-7">
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
                      className="mt-2 text-lg leading-relaxed lg:text-xl"
                      style={{ color: 'var(--mk-text)' }}
                    >
                      {beat.line}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div ref={plateRef} className="lg:col-span-7">
              <LeaderboardPlate />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
