'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isMarketingRoute } from '@/lib/marketing-routes'

/**
 * The marketing surface's pointer grammar: CTAs and nav links are gently
 * magnetic, translating a quarter of the cursor's offset from their center
 * and springing back on leave.
 *
 * One delegated listener set, scoped by selector to the .marketing world so
 * the application never feels it. Pointer devices with full motion only;
 * on touch or reduced motion this component is inert. Nothing here is
 * load-bearing: every magnetic element is an ordinary link or button first.
 */

const SELECTOR = '.marketing .mk-btn, .marketing nav a'
const STRENGTH = 0.22

export function CursorGrammar() {
  const active = isMarketingRoute(usePathname())

  useEffect(() => {
    if (!active) return
    if (
      !window.matchMedia(
        '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
      ).matches
    )
      return

    let held: HTMLElement | null = null

    const release = () => {
      if (!held) return
      const el = held
      held = null
      const from = el.style.transform
      el.style.transform = ''
      if (from) {
        el.animate(
          [{ transform: from }, { transform: 'translate(0px, 0px)' }],
          { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        )
      }
    }

    const onOver = (e: PointerEvent) => {
      const target = (e.target as Element).closest?.(SELECTOR)
      if (target instanceof HTMLElement && target !== held) {
        release()
        held = target
      }
    }

    const onOut = (e: PointerEvent) => {
      if (held && !held.contains(e.relatedTarget as Node)) release()
    }

    const onMove = (e: PointerEvent) => {
      if (!held) return
      const r = held.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      held.style.transform = `translate(${(dx * STRENGTH).toFixed(1)}px, ${(dy * STRENGTH).toFixed(1)}px)`
    }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('pointermove', onMove)
    return () => {
      release()
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('pointermove', onMove)
    }
  }, [active])

  return null
}
