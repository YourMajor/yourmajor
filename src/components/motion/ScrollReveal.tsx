'use client'

import { useInView } from '@/hooks/useInView'
import type { ReactNode, CSSProperties } from 'react'

type Direction = 'up' | 'down' | 'left' | 'right'

interface ScrollRevealProps {
  children: ReactNode
  direction?: Direction
  delay?: number
  duration?: number
  threshold?: number
  className?: string
}

const TRANSFORMS: Record<Direction, string> = {
  up: 'translateY(40px)',
  down: 'translateY(-40px)',
  left: 'translateX(40px)',
  right: 'translateX(-40px)',
}

export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 800,
  threshold = 0.15,
  className = '',
}: ScrollRevealProps) {
  const [ref, isInView] = useInView<HTMLDivElement>({ threshold, once: true })

  const style: CSSProperties = {
    opacity: isInView ? 1 : 0,
    transform: isInView ? 'none' : TRANSFORMS[direction],
    transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  }

  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  )
}
