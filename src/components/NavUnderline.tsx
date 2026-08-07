'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { isMarketingRoute } from '@/lib/marketing-routes'

/**
 * The gold rule that glides between nav links, overshooting slightly like a
 * needle finding its stop. Rendered inside the desktop nav; JS writes only
 * transform and opacity, the transition lives in globals.css and dies under
 * reduced motion. Pointer devices and marketing routes only; the rule is
 * flourish, the links are the affordance.
 */
export function NavUnderline() {
  const ref = useRef<HTMLSpanElement>(null)
  const active = isMarketingRoute(usePathname())

  useEffect(() => {
    if (!active) return
    const rule = ref.current
    const nav = rule?.parentElement
    if (!rule || !nav) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const show = (link: HTMLElement) => {
      const navRect = nav.getBoundingClientRect()
      const rect = link.getBoundingClientRect()
      // First appearance snaps into place; only travel between links glides.
      if (rule.style.opacity !== '1') {
        const t = rule.style.transition
        rule.style.transition = 'none'
        rule.style.transform = `translateX(${rect.left - navRect.left}px) scaleX(${rect.width / 100})`
        void rule.offsetWidth
        rule.style.transition = t
      } else {
        rule.style.transform = `translateX(${rect.left - navRect.left}px) scaleX(${rect.width / 100})`
      }
      rule.style.opacity = '1'
    }
    const hide = () => {
      rule.style.opacity = '0'
    }

    const onOver = (e: PointerEvent) => {
      const link = (e.target as Element).closest?.('a')
      if (link instanceof HTMLElement && nav.contains(link)) show(link)
    }
    const onLeave = () => hide()
    const onFocusIn = (e: FocusEvent) => {
      const link = (e.target as Element).closest?.('a')
      if (link instanceof HTMLElement) show(link)
    }

    nav.addEventListener('pointerover', onOver)
    nav.addEventListener('pointerleave', onLeave)
    nav.addEventListener('focusin', onFocusIn)
    nav.addEventListener('focusout', onLeave)
    return () => {
      nav.removeEventListener('pointerover', onOver)
      nav.removeEventListener('pointerleave', onLeave)
      nav.removeEventListener('focusin', onFocusIn)
      nav.removeEventListener('focusout', onLeave)
    }
  }, [active])

  if (!active) return null

  return (
    <span
      ref={ref}
      aria-hidden
      data-nav-rule
      className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-[100px] origin-left"
      style={{ background: 'var(--mk-gold)', opacity: 0, transform: 'scaleX(0)' }}
    />
  )
}
