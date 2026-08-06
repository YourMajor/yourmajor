'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

type Direction = 'up' | 'down' | 'left' | 'right'

interface ScrollRevealProps {
  children: ReactNode
  direction?: Direction
  delay?: number
  duration?: number
  threshold?: number
  className?: string
}

const OFFSETS: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
}

/**
 * Scroll-triggered reveal.
 *
 * The reveal is a rise, not a fade, and that is the whole point. An `initial`
 * of `opacity: 0` gates content behind the viewport callback: if the callback
 * is late, or never fires, the page is a void. That has happened twice on this
 * surface. Starting at full opacity means the worst case is content sitting
 * 40px low, which nobody notices, instead of content that is not there.
 *
 * Motion stays on transform, so it stays on the compositor.
 */
export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 800,
  threshold = 0.15,
  className = '',
}: ScrollRevealProps) {
  const reduce = useReducedMotion()

  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial={OFFSETS[direction]}
      whileInView={{ x: 0, y: 0 }}
      viewport={{ once: true, amount: threshold }}
      transition={{
        duration: duration / 1000,
        delay: delay / 1000,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
