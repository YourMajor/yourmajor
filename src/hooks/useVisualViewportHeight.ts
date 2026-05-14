'use client'

import { useEffect, useState } from 'react'

export interface VisualViewportRect {
  height: number
  offsetTop: number
}

interface Options {
  mobileOnly?: boolean
  mobileBreakpoint?: number
}

export function useVisualViewportHeight(options: Options = {}): VisualViewportRect | null {
  const { mobileOnly = false, mobileBreakpoint = 640 } = options
  const [rect, setRect] = useState<VisualViewportRect | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return

    let cancelled = false
    const mql = mobileOnly ? window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`) : null

    const update = () => {
      if (cancelled) return
      if (mql && !mql.matches) {
        setRect(null)
        return
      }
      setRect({ height: vv.height, offsetTop: vv.offsetTop })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    mql?.addEventListener('change', update)

    return () => {
      cancelled = true
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      mql?.removeEventListener('change', update)
    }
  }, [mobileOnly, mobileBreakpoint])

  return rect
}
