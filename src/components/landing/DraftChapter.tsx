'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { createDraggable, type Draggable } from 'animejs'
import { Zap, Swords, X } from 'lucide-react'
import { PowerupCard, type PowerupCardData } from '@/components/draft/PowerupCard'
import { EXAMPLE_BOOST, EXAMPLE_ATTACK } from '@/components/wizard/PowerupsInfoPanel'

gsap.registerPlugin(Flip)

/**
 * Chapter 4 — the powerup draft, played rather than described. A pool of six
 * cards; on pointer devices you drag one into your hand (anime Draggable with
 * a spring release; letting go anywhere else springs it home), on touch and
 * keyboard you tap or press to draft. A drafted card opens a focus-trapped
 * flip reveal. GSAP Flip carries the pool-to-hand travel so the card flies
 * from wherever you dropped it.
 *
 * Card faces are the real PowerupCard component; the four cards beyond the
 * two wizard examples are DEMONSTRATIONS written for this page, using slugs
 * the product's icon set already knows. The section is labeled as one.
 *
 * The card artwork keeps the product's own boost/attack border colors. That
 * is the real UI, shown honestly, same exception BrandingVisual holds.
 */

const DEMO_CARDS: PowerupCardData[] = [
  EXAMPLE_BOOST,
  {
    id: 'demo-walk-it-in',
    slug: 'walk-it-in',
    name: 'Walk It In',
    type: 'BOOST',
    description: 'Call your putt out loud before you hit it. If it drops, subtract one stroke.',
    effect: {
      scoring: { mode: 'auto', modifier: -1 },
      duration: 1,
      flavorText: 'Say it. Then do it.',
      requiresTarget: false,
    },
  },
  {
    id: 'demo-king-of-the-hill',
    slug: 'king-of-the-hill',
    name: 'King of the Hill',
    type: 'BOOST',
    description: 'Win this hole outright and your next bogey is scored as a par.',
    effect: {
      scoring: { mode: 'auto', modifier: -1 },
      duration: 1,
      flavorText: 'The crown carries.',
      requiresTarget: false,
    },
  },
  EXAMPLE_ATTACK,
  {
    id: 'demo-the-sandman',
    slug: 'the-sandman',
    name: 'The Sandman',
    type: 'ATTACK',
    description: 'Pick an opponent. Their next tee shot must aim at the far side of any bunker in range.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null },
      duration: 1,
      flavorText: 'Sleep tight down there.',
      requiresTarget: true,
    },
  },
  {
    id: 'demo-your-number',
    slug: 'can-i-get-your-number',
    name: 'Can I Get Your Number',
    type: 'ATTACK',
    description: 'Once this round, swap one completed hole score with the player who played this card on you. Wait, no. On them.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null },
      duration: 1,
      flavorText: 'A trade nobody agreed to.',
      requiresTarget: true,
    },
  },
]

const HAND_SIZE = 3

function CardModal({ card, onClose }: { card: PowerupCardData; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // Single focusable control, so trapping is keeping Tab on it.
      if (e.key === 'Tab') {
        e.preventDefault()
        closeRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} card`}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'var(--mk-scrim)' }}
        onClick={onClose}
      />
      <div
        className="mk-card-reveal relative flex max-w-md flex-col items-center gap-6 p-8"
        style={{
          background: 'var(--mk-green-deep)',
          border: '1px solid var(--mk-rule-gold)',
          borderRadius: 'var(--mk-radius-lg)',
        }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close card"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-80"
          style={{ color: 'var(--mk-text-muted)' }}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <PowerupCard powerup={card} size="lg" />
        <p
          className="max-w-[38ch] text-center text-sm leading-relaxed"
          style={{ color: 'var(--mk-text-muted)' }}
        >
          {card.description}
        </p>
      </div>
    </div>
  )
}

export function DraftChapter() {
  const stageRef = useRef<HTMLDivElement>(null)
  const handRef = useRef<HTMLDivElement>(null)
  const draggables = useRef<Map<string, Draggable>>(new Map())
  const flipState = useRef<Flip.FlipState | null>(null)
  const [drafted, setDrafted] = useState<string[]>([])
  const [modalCard, setModalCard] = useState<PowerupCardData | null>(null)

  const pool = DEMO_CARDS.filter((c) => !drafted.includes(c.id))
  const handFull = drafted.length >= HAND_SIZE

  const draftCard = useCallback((id: string) => {
    const stage = stageRef.current
    if (!stage) return
    flipState.current = Flip.getState(stage.querySelectorAll('[data-card]'))
    setDrafted((prev) => (prev.length >= HAND_SIZE || prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const resetHand = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    flipState.current = Flip.getState(stage.querySelectorAll('[data-card]'))
    setDrafted([])
  }, [])

  // The travel: after a draft or reset re-renders the card into its new home,
  // Flip animates it there from wherever it was, including mid-drag.
  useLayoutEffect(() => {
    const state = flipState.current
    if (!state) return
    flipState.current = null
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    Flip.from(state, {
      targets: stageRef.current?.querySelectorAll('[data-card]') ?? [],
      duration: reduce ? 0 : 0.55,
      ease: 'power3.inOut',
      absolute: true,
    })
  }, [drafted])

  // Pointer-device drag. Anything else drafts by tap or keyboard.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const wants = window.matchMedia(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    ).matches
    if (!wants) return

    const instances = draggables.current
    const zone = handRef.current

    stage.querySelectorAll<HTMLElement>('[data-pool-card]').forEach((el) => {
      const id = el.dataset.poolCard
      if (!id || instances.has(id)) return
      const d = createDraggable(el, {
        // Releasing anywhere but the hand springs the card home.
        snap: [0],
        releaseStiffness: 160,
        releaseDamping: 15,
        onGrab: () => {
          el.style.zIndex = '30'
          // Tilt yields while the card is in hand.
          el.classList.add('is-dragging')
          const tilt = el.querySelector<HTMLElement>('[data-tilt]')
          if (tilt) tilt.style.transform = ''
        },
        onRelease: (self) => {
          el.style.zIndex = ''
          el.classList.remove('is-dragging')
          const cardRect = el.getBoundingClientRect()
          const zoneRect = zone?.getBoundingClientRect()
          const overlaps =
            !!zoneRect &&
            cardRect.bottom > zoneRect.top &&
            cardRect.top < zoneRect.bottom &&
            cardRect.right > zoneRect.left &&
            cardRect.left < zoneRect.right
          if (overlaps) {
            self.stop()
            self.disable()
            draftCard(id)
          }
        },
      })
      instances.set(id, d)
    })

    return () => {
      instances.forEach((d) => d.revert())
      instances.clear()
    }
  }, [pool.length, draftCard])

  // Overdrive: pool cards tilt in 3D under the pointer and spring flat on
  // leave. One delegated listener pair; inert on touch and reduced motion,
  // and it yields entirely while a card is being dragged.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const wants = window.matchMedia(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    ).matches
    if (!wants) return

    const onMove = (e: PointerEvent) => {
      const wrap = (e.target as Element).closest?.('[data-pool-card]')
      if (!(wrap instanceof HTMLElement) || wrap.classList.contains('is-dragging')) return
      const tilt = wrap.querySelector<HTMLElement>('[data-tilt]')
      if (!tilt) return
      const r = wrap.getBoundingClientRect()
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -14
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 14
      tilt.style.transform = `perspective(600px) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`
    }
    const onOut = (e: PointerEvent) => {
      const wrap = (e.target as Element).closest?.('[data-pool-card]')
      if (!(wrap instanceof HTMLElement) || wrap.contains(e.relatedTarget as Node)) return
      const tilt = wrap.querySelector<HTMLElement>('[data-tilt]')
      if (!tilt) return
      const from = tilt.style.transform
      tilt.style.transform = ''
      if (from) {
        tilt.animate(
          [
            { transform: from },
            { transform: 'perspective(600px) rotateX(0deg) rotateY(0deg)' },
          ],
          { duration: 480, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
        )
      }
    }

    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerout', onOut)
    return () => {
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerout', onOut)
    }
  }, [])

  return (
    <section
      id="draft"
      className="mt-24 lg:mt-32"
      style={{ background: 'var(--mk-green-deep)' }}
      aria-label="Powerup draft demonstration"
    >
      <div className="mk-container py-20 lg:py-28">
        <div className="max-w-[60ch]">
          <Zap className="h-5 w-5" style={{ color: 'var(--mk-gold)' }} aria-hidden />
          <h3 className="mt-4 text-2xl lg:text-3xl">Draft your powerups</h3>
          <p className="mt-4 text-base leading-relaxed" style={{ color: 'var(--mk-text-muted)' }}>
            Before the round, players take turns pulling cards from a shared
            pool, then spend them mid-play against each other. Try it: drag a
            card into your hand, or tap one.
          </p>
        </div>

        <div ref={stageRef}>
          {/* The pool */}
          <div
            className="mt-12 flex flex-wrap items-start justify-center gap-4 lg:gap-6"
            role="group"
            aria-label="Card pool"
          >
            {/* PowerupCard renders its own <button>, so the Flip/drag wrapper
                is a plain div; the card's button IS the draft control. */}
            {pool.map((card, i) => (
              <div
                key={card.id}
                data-card
                data-flip-id={card.id}
                data-pool-card={card.id}
                className="touch-none"
                style={{
                  rotate: `${(i - (pool.length - 1) / 2) * 3.5}deg`,
                  cursor: handFull ? 'default' : 'grab',
                }}
              >
                <div data-tilt className="will-change-transform">
                  <PowerupCard
                    powerup={card}
                    size="sm"
                    disabled={handFull}
                    onClick={() => draftCard(card.id)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center justify-center gap-3">
            <Zap className="h-3.5 w-3.5" style={{ color: 'var(--mk-gold)' }} aria-hidden />
            <span className="text-xs" style={{ color: 'var(--mk-text-subtle)' }}>
              Boosts help your game. Attacks point at someone else&apos;s.
            </span>
            <Swords className="h-3.5 w-3.5" style={{ color: 'var(--mk-gold)' }} aria-hidden />
          </div>

          {/* The hand */}
          <div className="mt-10">
            <div
              className="mx-auto flex max-w-xl items-baseline justify-between pb-3"
              style={{ borderBottom: '2px solid var(--mk-gold)' }}
            >
              <span
                className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--mk-gold)' }}
              >
                Your hand
              </span>
              <span className="mk-data text-sm" style={{ color: 'var(--mk-text-muted)' }}>
                {drafted.length} of {HAND_SIZE}
              </span>
            </div>

            <div
              ref={handRef}
              className="mx-auto mt-6 flex max-w-xl items-start justify-center gap-4 lg:gap-6"
            >
              {Array.from({ length: HAND_SIZE }).map((_, i) => {
                const card = DEMO_CARDS.find((c) => c.id === drafted[i])
                return card ? (
                  <div
                    key={card.id}
                    data-card
                    data-flip-id={card.id}
                    className="transition-transform hover:-translate-y-1 motion-reduce:transition-none"
                  >
                    <PowerupCard powerup={card} size="sm" onClick={() => setModalCard(card)} />
                  </div>
                ) : (
                  <div
                    key={`slot-${i}`}
                    aria-hidden
                    className="h-[160px] w-[110px] shrink-0"
                    style={{
                      border: '1px dashed var(--mk-rule-gold)',
                      borderRadius: 'var(--mk-radius-lg)',
                    }}
                  />
                )
              })}
            </div>

            <div className="mt-6 flex items-center justify-center gap-6">
              {drafted.length > 0 && (
                <button
                  type="button"
                  onClick={resetHand}
                  className="text-sm underline-offset-4 hover:underline"
                  style={{ color: 'var(--mk-text-subtle)' }}
                >
                  Deal them back
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-xs" style={{ color: 'var(--mk-text-subtle)' }}>
          A demonstration. In a live draft the pool is shared and the turn
          order is real; a random deal skips the ceremony and takes seconds.
        </p>
      </div>

      {modalCard && <CardModal card={modalCard} onClose={() => setModalCard(null)} />}
    </section>
  )
}
