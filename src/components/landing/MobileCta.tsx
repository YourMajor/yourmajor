'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

/**
 * The landing page is ~15,000px tall on a phone and pricing sits near the
 * bottom; without this, a one-handed visitor never meets a CTA after the
 * hero. A compact bar slides up once the hero has scrolled away and stays
 * in the thumb zone. Mobile only (the desktop rail and nav carry the job
 * there); visibility is written straight to the DOM, no state.
 */
export function MobileCta() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const hero = document.getElementById('hero')
    if (!el || !hero) return
    const io = new IntersectionObserver(
      ([entry]) => {
        el.dataset.visible = entry.isIntersecting ? 'false' : 'true'
      },
      { threshold: 0.1 },
    )
    io.observe(hero)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} data-visible="false" className="mk-mobile-cta lg:hidden">
      <Link href="/auth/signup" className="mk-btn mk-btn-primary w-full">
        Create a tournament
      </Link>
    </div>
  )
}
