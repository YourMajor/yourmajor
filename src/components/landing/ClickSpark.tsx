'use client'

import { useEffect, useRef } from 'react'

/**
 * A gold spark burst at the click point: pointer-device feedback for the
 * primary CTAs, adapted from React Bits' ClickSpark. The canvas bleeds past
 * the wrapped row so sparks are not clipped at a button edge, the rAF loop
 * runs only while sparks are alive, and the whole effect is inert on touch
 * and under reduced motion.
 */

const BLEED = 32
const COUNT = 9
const DURATION = 420
const RADIUS = 22
const SIZE = 9

type Spark = { x: number; y: number; angle: number; born: number }

export function ClickSpark({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sparksRef = useRef<Spark[]>([])
  const rafRef = useRef(0)

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const onClick = (e: React.MouseEvent) => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    if (!window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches)
      return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = root.getBoundingClientRect()
    const w = rect.width + BLEED * 2
    const h = rect.height + BLEED * 2
    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle =
      getComputedStyle(root).getPropertyValue('--mk-gold').trim() || 'oklch(0.72 0.11 78)'

    const now = performance.now()
    const x = e.clientX - rect.left + BLEED
    const y = e.clientY - rect.top + BLEED
    for (let i = 0; i < COUNT; i += 1) {
      sparksRef.current.push({
        x,
        y,
        angle: (2 * Math.PI * i) / COUNT + Math.random() * 0.4,
        born: now,
      })
    }

    cancelAnimationFrame(rafRef.current)
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      sparksRef.current = sparksRef.current.filter((s) => {
        const p = (t - s.born) / DURATION
        if (p >= 1) return false
        const ease = p * (2 - p)
        const d = ease * RADIUS
        const len = SIZE * (1 - ease)
        ctx.beginPath()
        ctx.moveTo(s.x + d * Math.cos(s.angle), s.y + d * Math.sin(s.angle))
        ctx.lineTo(s.x + (d + len) * Math.cos(s.angle), s.y + (d + len) * Math.sin(s.angle))
        ctx.stroke()
        return true
      })
      if (sparksRef.current.length) {
        rafRef.current = requestAnimationFrame(draw)
      } else {
        ctx.clearRect(0, 0, w, h)
      }
    }
    rafRef.current = requestAnimationFrame(draw)
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`} onClickCapture={onClick}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute z-10"
        style={{
          inset: -BLEED,
          width: `calc(100% + ${BLEED * 2}px)`,
          height: `calc(100% + ${BLEED * 2}px)`,
        }}
      />
      {children}
    </div>
  )
}
