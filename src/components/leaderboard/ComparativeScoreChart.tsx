'use client'

import { useMemo, useState } from 'react'
import { type PlayerStanding } from '@/lib/scoring-utils'

/** Monotone-x cubic bezier spline through points */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2)
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

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

// Distinct colors for up to ~12 players — ordered for maximum contrast
const PLAYER_COLORS = [
  '#006747', // masters green
  '#dc2626', // red
  '#2563eb', // blue
  '#d97706', // amber
  '#7c3aed', // purple
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#ea580c', // orange
  '#4f46e5', // indigo
  '#0d9488', // teal
  '#be123c', // rose
]

function getShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return parts[0]
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`
}

interface Props {
  standings: PlayerStanding[]
  roundNumber?: number // which round to chart (defaults to the latest)
}

export function ComparativeScoreChart({ standings, roundNumber }: Props) {
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null)

  // Pre-compute all the chart geometry once per `standings` change. Hovering
  // a legend entry only flips `hoveredPlayer`, so without this memo the
  // O(N×holes) cumulative + smoothPath work would re-run on every mouseover.
  const chart = useMemo(() => {
    type PlayerLine = {
      id: string
      name: string
      shortName: string
      finalScore: number
      cumulative: Array<{ hole: number; value: number }>
    }

    const allRounds = new Set<number>()
    for (const p of standings) {
      for (const h of p.holes) {
        if (h.roundNumber) allRounds.add(h.roundNumber)
      }
    }
    const targetRound = roundNumber ?? (allRounds.size > 0 ? Math.max(...allRounds) : 1)

    const lines: PlayerLine[] = []
    for (const player of standings) {
      const roundHoles = player.holes
        .filter((h) => (h.roundNumber ?? 1) === targetRound && h.strokes !== null && h.diff !== null)
        .sort((a, b) => a.holeNumber - b.holeNumber)

      if (roundHoles.length === 0) continue

      let cumulative = 0
      const points: Array<{ hole: number; value: number }> = []
      for (const h of roundHoles) {
        cumulative += h.diff!
        points.push({ hole: h.holeNumber, value: cumulative })
      }

      lines.push({
        id: player.tournamentPlayerId,
        name: player.playerName,
        shortName: getShortName(player.playerName),
        finalScore: cumulative,
        cumulative: points,
      })
    }

    if (lines.length < 2) return null

    lines.sort((a, b) => a.finalScore - b.finalScore)

    const holeNumbers = [...new Set(lines.flatMap((l) => l.cumulative.map((c) => c.hole)))].sort(
      (a, b) => a - b,
    )
    if (holeNumbers.length < 2) return null

    const w = 640
    const h = 300
    const pad = { top: 24, right: 16, bottom: 36, left: 40 }
    const chartW = w - pad.left - pad.right
    const chartH = h - pad.top - pad.bottom

    let minY = 0
    let maxY = 0
    for (const line of lines) {
      for (const pt of line.cumulative) {
        if (pt.value < minY) minY = pt.value
        if (pt.value > maxY) maxY = pt.value
      }
    }
    minY = Math.min(minY - 1, -1)
    maxY = Math.max(maxY + 1, 1)
    const yRange = maxY - minY

    const xScale = (hole: number) => {
      const idx = holeNumbers.indexOf(hole)
      return pad.left + (idx / (holeNumbers.length - 1)) * chartW
    }
    const yScale = (val: number) => pad.top + ((maxY - val) / yRange) * chartH

    const gridLines: number[] = []
    for (let v = Math.ceil(minY); v <= Math.floor(maxY); v++) {
      gridLines.push(v)
    }

    // Pre-compute each player's SVG path + scaled points so hover only
    // changes opacity, not geometry.
    const linePaths = new Map<string, { pts: Array<{ x: number; y: number }>; path: string }>()
    for (const line of lines) {
      const pts = line.cumulative.map((c) => ({ x: xScale(c.hole), y: yScale(c.value) }))
      linePaths.set(line.id, { pts, path: smoothPath(pts) })
    }

    return { lines, holeNumbers, w, h, pad, yRange, xScale, yScale, gridLines, linePaths }
  }, [standings, roundNumber])

  if (!chart) return null
  const { lines, holeNumbers, w, h, pad, yRange, xScale, yScale, gridLines, linePaths } = chart

  return (
    <div className="mt-6 space-y-3 pt-5 border-t border-border">
      <h3 className="text-lg sm:text-xl font-heading font-bold text-foreground">
        Score Progression
      </h3>
      <p className="text-xs text-muted-foreground">
        Cumulative score to par, hole by hole
      </p>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full max-w-[640px]"
          style={{ minWidth: 360 }}
        >
          {/* Grid lines */}
          {gridLines.map((v) => (
            <line
              key={v}
              x1={pad.left}
              y1={yScale(v)}
              x2={w - pad.right}
              y2={yScale(v)}
              stroke={v === 0 ? '#d4d4d8' : '#f3f4f6'}
              strokeWidth={v === 0 ? 1.5 : 0.5}
            />
          ))}

          {/* Y-axis labels */}
          {gridLines
            .filter((v) => v % (yRange > 12 ? 2 : 1) === 0)
            .map((v) => (
              <text
                key={v}
                x={pad.left - 8}
                y={yScale(v) + 3.5}
                textAnchor="end"
                style={{ fontSize: 9, fill: '#9ca3af', fontFamily: 'inherit' }}
              >
                {v === 0 ? 'E' : v > 0 ? `+${v}` : `${v}`}
              </text>
            ))}

          {/* Hole number labels on X axis */}
          {holeNumbers.map((hole) => (
            <text
              key={hole}
              x={xScale(hole)}
              y={h - pad.bottom + 14}
              textAnchor="middle"
              style={{ fontSize: 9, fill: '#6b7280', fontFamily: 'inherit' }}
            >
              {hole}
            </text>
          ))}

          {/* Player lines — draw non-hovered first, hovered on top */}
          {lines.map((line, idx) => {
            const color = PLAYER_COLORS[idx % PLAYER_COLORS.length]
            const isHovered = hoveredPlayer === line.id
            const isAnyHovered = hoveredPlayer !== null
            const isLeader = idx === 0
            const opacity = isAnyHovered ? (isHovered ? 1 : 0.15) : isLeader ? 1 : 0.5

            const cached = linePaths.get(line.id)!
            const pts = cached.pts
            const path = cached.path

            return (
              <g key={line.id} style={{ opacity, transition: 'opacity 0.2s' }}>
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={isLeader || isHovered ? 2.5 : 1.5}
                  strokeLinecap="round"
                />
                {/* Endpoint dot with final score label */}
                {pts.length > 0 && (
                  <>
                    <circle
                      cx={pts[pts.length - 1].x}
                      cy={pts[pts.length - 1].y}
                      r={isLeader || isHovered ? 4 : 3}
                      fill={color}
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    {/* Show name at the end of the line when hovered or for leader */}
                    {(isHovered || (isLeader && !isAnyHovered)) && (
                      <text
                        x={pts[pts.length - 1].x + 6}
                        y={pts[pts.length - 1].y + 3.5}
                        style={{
                          fontSize: 9,
                          fill: color,
                          fontWeight: 600,
                          fontFamily: 'inherit',
                        }}
                      >
                        {line.shortName} ({line.finalScore === 0 ? 'E' : line.finalScore > 0 ? `+${line.finalScore}` : line.finalScore})
                      </text>
                    )}
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {lines.map((line, idx) => {
          const color = PLAYER_COLORS[idx % PLAYER_COLORS.length]
          const isHovered = hoveredPlayer === line.id
          return (
            <button
              key={line.id}
              type="button"
              className="flex items-center gap-1.5 text-[11px] rounded px-1 py-0.5 transition-colors cursor-pointer"
              style={{
                opacity: hoveredPlayer !== null && !isHovered ? 0.4 : 1,
                fontWeight: isHovered ? 700 : 500,
              }}
              onMouseEnter={() => setHoveredPlayer(line.id)}
              onMouseLeave={() => setHoveredPlayer(null)}
              onFocus={() => setHoveredPlayer(line.id)}
              onBlur={() => setHoveredPlayer(null)}
            >
              <span
                className="inline-block w-3 h-[3px] rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-foreground">{line.shortName}</span>
              <span className="text-muted-foreground">
                ({line.finalScore === 0 ? 'E' : line.finalScore > 0 ? `+${line.finalScore}` : line.finalScore})
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
