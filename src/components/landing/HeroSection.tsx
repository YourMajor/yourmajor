'use client'

import { useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { LeaderboardPlate, ROUND_STATES, scoreColor } from './LeaderboardPlate'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Motion thesis for this page: prove the product is live. A leaderboard that
 * moves while you read it is the one claim a static page cannot make, so the
 * hero pins and plays the last six holes of a round as you scroll, ending on a
 * lead change.
 *
 * Two constraints this respects, both of which have cost time on this branch:
 *  - Nothing is gated behind the scroll. The plate renders the final board and
 *    stays fully readable; the sequence only winds it back and forward again.
 *  - The pin is desktop only. On a phone a pinned hero costs a screen of scroll
 *    for a board that is already legible, so there is no ScrollTrigger at all
 *    below 1024px, and none under reduced motion.
 */
function paintBoard(plate: HTMLElement, stateIndex: number) {
  const state = ROUND_STATES[stateIndex]
  const rows = plate.querySelectorAll<HTMLElement>('[data-row]')
  if (!state || rows.length !== state.length) return

  const step = rows.length > 1 ? rows[1].offsetTop - rows[0].offsetTop : 0

  state.forEach((cell, i) => {
    const row = rows[i]
    const write = (name: string, value: string, color?: string) => {
      const node = row.querySelector<HTMLElement>(`[data-cell="${name}"]`)
      if (!node) return
      node.textContent = value
      if (color) node.style.color = color
    }

    write('pos', cell.pos)
    write('today', cell.today, scoreColor(cell.today))
    write('thru', cell.thru)
    write('total', cell.total, scoreColor(cell.total))

    gsap.to(row, {
      y: (cell.slot - i) * step,
      duration: 0.45,
      ease: 'power2.inOut',
      overwrite: 'auto',
    })
  })
}

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const plateRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()

      media.add(
        {
          desktop: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
        },
        () => {
          const plate = plateRef.current
          if (!plate) return

          // Idempotent paint keyed off progress, rather than timeline callbacks:
          // a fast scrub can skip a callback, and it can never skip this.
          let painted = -1
          const paint = (index: number) => {
            if (index === painted) return
            painted = index
            paintBoard(plate, index)
          }

          const trigger = ScrollTrigger.create({
            trigger: sectionRef.current,
            start: 'top top',
            end: '+=85%',
            pin: true,
            scrub: true,
            onUpdate: (self) => {
              paint(self.progress < 0.34 ? 0 : self.progress < 0.7 ? 1 : 2)
            },
          })

          gsap.to(messageRef.current, {
            y: -48,
            opacity: 0.65,
            ease: 'none',
            scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: '+=85%', scrub: true },
          })

          return () => {
            trigger.kill()
            gsap.set(plate.querySelectorAll('[data-row]'), { clearProps: 'transform' })
          }
        },
      )

      return () => media.revert()
    },
    { scope: sectionRef },
  )

  return (
    <section ref={sectionRef} className="relative flex min-h-[100dvh] items-center pt-24 pb-16">
      {/* Ground: the deep stop sits behind the fold so the page reads as one
          field rather than a banded gradient. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(175deg, var(--mk-green-ground) 0%, var(--mk-green-raised) 45%, var(--mk-green-deep) 100%)',
        }}
      />

      <div className="mk-container relative z-10 w-full">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
          {/* Message */}
          <div ref={messageRef} className="lg:col-span-6 xl:col-span-5">
            <h1 className="text-balance">
              Tournament Golf,{' '}
              <span style={{ color: 'var(--mk-gold)' }}>Simplified.</span>
            </h1>

            <p
              className="mt-7 max-w-[46ch] text-lg leading-relaxed"
              style={{ color: 'var(--mk-text-muted)' }}
            >
              Live leaderboards, digital scorecards, and powerup drafts.
              Everything your golf group needs.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/signup" className="mk-btn mk-btn-primary">
                Create a tournament
              </Link>
              <Link href="/tournaments" className="mk-btn mk-btn-secondary">
                Join with a code
              </Link>
            </div>
          </div>

          {/* Proof: the product's own furniture, not a picture of it. */}
          <div ref={plateRef} className="lg:col-span-6 xl:col-span-7">
            <LeaderboardPlate />
          </div>
        </div>
      </div>
    </section>
  )
}
