'use client'

import { useSyncExternalStore } from 'react'
import { useInView } from '@/hooks/useInView'

// Local reduced-motion read; not worth pulling motion/react into this chunk.
const rmQuery = '(prefers-reduced-motion: reduce)'
function subscribeRM(cb: () => void) {
  const mq = window.matchMedia(rmQuery)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
function useReducedMotion() {
  return useSyncExternalStore(subscribeRM, () => window.matchMedia(rmQuery).matches, () => false)
}

interface HoleScore {
  holeNumber: number
  par: number
  strokes: number
  hasScore: boolean
  putts?: number | null
  fairwayHit?: boolean | null
  gir?: boolean | null
}

/** Build a smooth cubic bezier SVG path through points (monotone-x spline) */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  const n = points.length
  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = []

  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    dy.push(points[i + 1].y - points[i].y)
    m.push(dy[i] / (dx[i] || 1))
  }

  const tangents: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents.push(0)
    } else {
      tangents.push((m[i - 1] + m[i]) / 2)
    }
  }
  tangents.push(m[n - 2])

  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const segDx = dx[i] / 3
    const cp1x = points[i].x + segDx
    const cp1y = points[i].y + tangents[i] * segDx
    const cp2x = points[i + 1].x - segDx
    const cp2y = points[i + 1].y - tangents[i + 1] * segDx
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${points[i + 1].x.toFixed(1)},${points[i + 1].y.toFixed(1)}`
  }
  return d
}

/** Linear regression trend line */
function trendLine(points: Array<{ x: number; y: number }>): { x1: number; y1: number; x2: number; y2: number } | null {
  if (points.length < 3) return null
  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return {
    x1: points[0].x, y1: slope * points[0].x + intercept,
    x2: points[n - 1].x, y2: slope * points[n - 1].x + intercept,
  }
}

const MONO = 'var(--font-google-sans-code), ui-monospace, monospace'

/**
 * The round, read aloud: the score line draws itself hole by hole once the
 * chart scrolls into view, dots land in sequence behind the pen, and the
 * putt line follows. pathLength is normalized to 1 so the dash draw needs
 * no measurement; reduced motion renders the finished chart immediately.
 */
export function RoundChart({ holes }: { holes: HoleScore[] }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.35, once: true })
  const reduce = useReducedMotion()
  const drawn = inView || reduce

  const sorted = [...holes].filter(h => h.hasScore).sort((a, b) => a.holeNumber - b.holeNumber)
  if (sorted.length === 0) return null

  const w = 600
  const h = 240
  const pad = { top: 20, right: 20, bottom: 50, left: 35 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom

  const diffs = sorted.map(s => s.strokes - s.par)
  const maxDiff = Math.max(3, ...diffs.map(d => Math.abs(d)))
  // Under par plots UP (broadcast convention): negative diff -> smaller y.
  // The previous scale had the sign flipped, which put birdies on the +1
  // line and bogeys on the -1 line.
  const yScale = (d: number) => pad.top + chartH / 2 + (d / maxDiff) * (chartH / 2)
  const xScale = (i: number) => pad.left + (i / (sorted.length - 1 || 1)) * chartW

  const scorePoints = sorted.map((_, i) => ({ x: xScale(i), y: yScale(diffs[i]) }))
  const scoreSmooth = smoothPath(scorePoints)
  const trend = trendLine(scorePoints)

  const puttsData = sorted.map(s => s.putts ?? null)
  const validPutts = puttsData.filter((p): p is number => p !== null)
  const maxPutts = Math.max(4, ...validPutts)
  const puttYScale = (p: number) => pad.top + chartH - (p / maxPutts) * chartH * 0.8
  const puttPoints = puttsData.map((p, i) => p !== null ? { x: xScale(i), y: puttYScale(p) } : null).filter((p): p is { x: number; y: number } => p !== null)
  const puttSmooth = puttPoints.length >= 2 ? smoothPath(puttPoints) : ''

  // The pen: normalized dash draw. 0 offset = fully drawn.
  const DRAW_MS = 1100
  const drawStyle = (delay: number, duration: number) => ({
    strokeDasharray: 1,
    strokeDashoffset: drawn ? 0 : 1,
    transition: reduce ? 'none' : `stroke-dashoffset ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
  })
  // Dots and annotations land behind the pen, in hole order.
  const landStyle = (i: number) => ({
    opacity: drawn ? 1 : 0,
    transition: reduce ? 'none' : `opacity 180ms ease-out ${(i / Math.max(1, sorted.length - 1)) * DRAW_MS * 0.9}ms`,
  })

  // Red means under par; a missed fairway is never an error, just quiet.
  const hitColor = 'var(--success)'
  const hitDark = 'color-mix(in oklab, var(--success), black 35%)'
  const missColor = 'var(--score-double)'

  const firIcon = (cx: number, cy: number, hit: boolean) => (
    <g transform={`translate(${cx - 5}, ${cy - 4})`} opacity={hit ? 1 : 0.35}>
      <path d="M5,0 L8,4 L6.5,3.5 L9,7 L1,7 L3.5,3.5 L2,4 Z" fill={hit ? hitColor : missColor} />
      <rect x="4.2" y="7" width="1.6" height="2" fill={hit ? hitDark : missColor} />
    </g>
  )

  const girIcon = (cx: number, cy: number, hit: boolean) => (
    <g transform={`translate(${cx - 4}, ${cy - 4})`} opacity={hit ? 1 : 0.35}>
      <ellipse cx="4" cy="6" rx="4" ry="2.5" fill={hit ? hitColor : missColor} />
      <line x1="4" y1="0" x2="4" y2="5" stroke={hit ? hitDark : missColor} strokeWidth="0.8" />
      <path d="M4,0 L7.5,1.5 L4,3 Z" fill={hit ? hitDark : missColor} />
    </g>
  )

  return (
    <div ref={ref} className="space-y-3 pt-4 border-t border-border">
      <h3 className="text-2xl font-heading font-bold">Round Performance</h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[600px]" style={{ minWidth: 400 }}>
          <line x1={pad.left} y1={yScale(0)} x2={w - pad.right} y2={yScale(0)} stroke="var(--border)" strokeWidth="1" />
          {[-2, -1, 1, 2].filter(d => Math.abs(d) <= maxDiff).map(d => (
            <line key={d} x1={pad.left} y1={yScale(d)} x2={w - pad.right} y2={yScale(d)} stroke="color-mix(in oklab, var(--border) 45%, transparent)" strokeWidth="0.5" />
          ))}

          <text x={pad.left - 8} y={yScale(0) + 4} textAnchor="end" style={{ fontSize: 10, fill: 'var(--muted-foreground)', fontFamily: MONO }}>E</text>
          {[1, 2].filter(d => d <= maxDiff).map(d => (
            <g key={d}>
              <text x={pad.left - 8} y={yScale(-d) + 4} textAnchor="end" style={{ fontSize: 9, fill: 'var(--score-birdie)', fontFamily: MONO }}>-{d}</text>
              <text x={pad.left - 8} y={yScale(d) + 4} textAnchor="end" style={{ fontSize: 9, fill: 'var(--muted-foreground)', fontFamily: MONO }}>+{d}</text>
            </g>
          ))}

          {trend && (
            <line x1={trend.x1} y1={trend.y1} x2={trend.x2} y2={trend.y2}
              stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="6,4" opacity={drawn ? 0.6 : 0}
              style={{ transition: reduce ? 'none' : `opacity 300ms ease-out ${DRAW_MS}ms` }} />
          )}

          {puttSmooth && (
            <path d={puttSmooth} pathLength={1} fill="none" stroke="var(--chart-2)" strokeWidth="2" opacity="0.65" strokeLinecap="round"
              style={drawStyle(350, DRAW_MS)} />
          )}

          {sorted.map((s, i) => {
            if (s.putts === null || s.putts === undefined) return null
            const px = xScale(i)
            const py = puttYScale(s.putts)
            return (
              <g key={`putt-${s.holeNumber}`} style={landStyle(i)}>
                <circle cx={px} cy={py} r="8" fill="var(--chart-2)" opacity="0.15" />
                <circle cx={px} cy={py} r="5" fill="var(--card)" stroke="var(--chart-2)" strokeWidth="1.5" />
                <text x={px} y={py + 3.5} textAnchor="middle" style={{ fontSize: 7, fontWeight: 700, fill: 'var(--chart-2)', fontFamily: MONO }}>
                  {s.putts}
                </text>
              </g>
            )
          })}

          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${scoreSmooth} L${xScale(sorted.length - 1)},${yScale(0)} L${xScale(0)},${yScale(0)} Z`}
            fill="url(#scoreGrad)"
            opacity={drawn ? 1 : 0}
            style={{ transition: reduce ? 'none' : `opacity 500ms ease-out ${DRAW_MS * 0.8}ms` }}
          />
          <path d={scoreSmooth} pathLength={1} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round"
            style={drawStyle(0, DRAW_MS)} />

          {sorted.map((s, i) => {
            const diff = diffs[i]
            const fill = diff <= -1 ? 'var(--score-birdie)' : diff === 0 ? 'var(--color-primary)' : 'var(--score-bogey)'
            return (
              <circle key={`score-${s.holeNumber}`} cx={xScale(i)} cy={yScale(diff)} r="4.5" fill={fill} stroke="var(--card)" strokeWidth="2" style={landStyle(i)} />
            )
          })}

          {sorted.map((s, i) => (
            <text key={s.holeNumber} x={xScale(i)} y={h - pad.bottom + 4} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--muted-foreground)', fontFamily: MONO }}>
              {s.holeNumber}
            </text>
          ))}

          {sorted.map((s, i) => {
            if (s.par < 4 || s.fairwayHit === null) return null
            return <g key={`fir-${s.holeNumber}`} style={landStyle(i)}>{firIcon(xScale(i), h - pad.bottom + 16, s.fairwayHit === true)}</g>
          })}

          {sorted.map((s, i) => {
            if (s.gir === null) return null
            return <g key={`gir-${s.holeNumber}`} style={landStyle(i)}>{girIcon(xScale(i), h - pad.bottom + 30, s.gir === true)}</g>
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-[3px] rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
          <span>Score vs Par</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-[3px] rounded-full opacity-65" style={{ backgroundColor: 'var(--chart-2)' }} />
          <span>Putts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-[3px] rounded-full" style={{ backgroundColor: 'var(--muted-foreground)' }} />
          <span>Trend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg viewBox="0 0 10 10" className="w-3 h-3"><path d="M5,0 L8,4 L6.5,3.5 L9,7 L1,7 L3.5,3.5 L2,4 Z" fill="var(--success)" /><rect x="4.2" y="7" width="1.6" height="2" fill="color-mix(in oklab, var(--success), black 35%)" /></svg>
          <span>FIR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg viewBox="0 0 8 9" className="w-3 h-3"><ellipse cx="4" cy="6" rx="4" ry="2.5" fill="var(--success)" /><line x1="4" y1="0" x2="4" y2="5" stroke="color-mix(in oklab, var(--success), black 35%)" strokeWidth="0.8" /><path d="M4,0 L7.5,1.5 L4,3 Z" fill="color-mix(in oklab, var(--success), black 35%)" /></svg>
          <span>GIR</span>
        </div>
      </div>
    </div>
  )
}
