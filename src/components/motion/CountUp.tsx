'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView } from '@/hooks/useInView'

interface CountUpProps {
  to: number
  from?: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
  signed?: boolean
}

const EASE = (t: number) => 1 - Math.pow(1 - t, 3)

export function CountUp({
  to,
  from = 0,
  duration = 1100,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  signed = false,
}: CountUpProps) {
  const [ref, isInView] = useInView<HTMLSpanElement>({ threshold: 0.3, once: true })
  // Skip the animation when the delta is too small to read as a count-up —
  // a fractional sweep like 0.0 → 0.1 → 0.2 looks like blinking, not counting.
  const skipAnimation = Math.abs(to - from) < 1
  const [value, setValue] = useState(skipAnimation ? to : from)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isInView || skipAnimation) return
    const start = performance.now()
    const delta = to - from

    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      setValue(from + delta * EASE(t))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isInView, to, from, duration, skipAnimation])

  const formatted = value.toFixed(decimals)
  const display = signed && value > 0 ? `+${formatted}` : formatted

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
