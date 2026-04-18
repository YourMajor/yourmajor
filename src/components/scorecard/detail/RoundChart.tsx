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

export function RoundChart({ holes }: { holes: HoleScore[] }) {
  const sorted = [...holes].filter(h => h.hasScore).sort((a, b) => a.holeNumber - b.holeNumber)
  if (sorted.length === 0) return null

  const w = 600
  const h = 240
  const pad = { top: 20, right: 20, bottom: 50, left: 35 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom

  const diffs = sorted.map(s => s.strokes - s.par)
  const maxDiff = Math.max(3, ...diffs.map(d => Math.abs(d)))
  const yScale = (d: number) => pad.top + chartH / 2 - (d / maxDiff) * (chartH / 2)
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

  const firIcon = (cx: number, cy: number, hit: boolean) => (
    <g transform={`translate(${cx - 5}, ${cy - 4})`} opacity={hit ? 1 : 0.3}>
      <path d="M5,0 L8,4 L6.5,3.5 L9,7 L1,7 L3.5,3.5 L2,4 Z" fill={hit ? '#22c55e' : '#ef4444'} />
      <rect x="4.2" y="7" width="1.6" height="2" fill={hit ? '#166534' : '#991b1b'} />
    </g>
  )

  const girIcon = (cx: number, cy: number, hit: boolean) => (
    <g transform={`translate(${cx - 4}, ${cy - 4})`} opacity={hit ? 1 : 0.3}>
      <ellipse cx="4" cy="6" rx="4" ry="2.5" fill={hit ? '#22c55e' : '#ef4444'} />
      <line x1="4" y1="0" x2="4" y2="5" stroke={hit ? '#166534' : '#991b1b'} strokeWidth="0.8" />
      <path d="M4,0 L7.5,1.5 L4,3 Z" fill={hit ? '#dc2626' : '#991b1b'} />
    </g>
  )

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <h3 className="text-2xl font-heading font-bold">Round Performance</h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[600px]" style={{ minWidth: 400 }}>
          <line x1={pad.left} y1={yScale(0)} x2={w - pad.right} y2={yScale(0)} stroke="#d4d4d8" strokeWidth="1" />
          {[-2, -1, 1, 2].filter(d => Math.abs(d) <= maxDiff).map(d => (
            <line key={d} x1={pad.left} y1={yScale(d)} x2={w - pad.right} y2={yScale(d)} stroke="#f3f4f6" strokeWidth="0.5" />
          ))}

          <text x={pad.left - 8} y={yScale(0) + 4} textAnchor="end" style={{ fontSize: 10, fill: '#9ca3af' }}>E</text>
          {[1, 2].filter(d => d <= maxDiff).map(d => (
            <g key={d}>
              <text x={pad.left - 8} y={yScale(d) + 4} textAnchor="end" style={{ fontSize: 9, fill: '#9ca3af' }}>-{d}</text>
              <text x={pad.left - 8} y={yScale(-d) + 4} textAnchor="end" style={{ fontSize: 9, fill: '#9ca3af' }}>+{d}</text>
            </g>
          ))}

          {trend && (
            <line x1={trend.x1} y1={trend.y1} x2={trend.x2} y2={trend.y2}
              stroke="#9ca3af" strokeWidth="1" strokeDasharray="6,4" opacity="0.6" />
          )}

          {puttSmooth && (
            <path d={puttSmooth} fill="none" stroke="#7c3aed" strokeWidth="2" opacity="0.6" strokeLinecap="round" />
          )}

          {sorted.map((s, i) => {
            if (s.putts === null || s.putts === undefined) return null
            const px = xScale(i)
            const py = puttYScale(s.putts)
            return (
              <g key={`putt-${s.holeNumber}`}>
                <circle cx={px} cy={py} r="8" fill="#7c3aed" opacity="0.15" />
                <circle cx={px} cy={py} r="5" fill="white" stroke="#7c3aed" strokeWidth="1.5" />
                <text x={px} y={py + 3.5} textAnchor="middle" style={{ fontSize: 7, fontWeight: 700, fill: '#7c3aed' }}>
                  {s.putts}
                </text>
              </g>
            )
          })}

          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary, #006747)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--color-primary, #006747)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${scoreSmooth} L${xScale(sorted.length - 1)},${yScale(0)} L${xScale(0)},${yScale(0)} Z`}
            fill="url(#scoreGrad)"
          />
          <path d={scoreSmooth} fill="none" stroke="var(--color-primary, #006747)" strokeWidth="2.5" strokeLinecap="round" />

          {sorted.map((s, i) => {
            const diff = diffs[i]
            const fill = diff <= -1 ? '#dc2626' : diff === 0 ? 'var(--color-primary, #006747)' : '#374151'
            return (
              <circle key={`score-${s.holeNumber}`} cx={xScale(i)} cy={yScale(diff)} r="4.5" fill={fill} stroke="white" strokeWidth="2" />
            )
          })}

          {sorted.map((s, i) => (
            <text key={s.holeNumber} x={xScale(i)} y={h - pad.bottom + 4} textAnchor="middle" style={{ fontSize: 9, fill: '#6b7280' }}>
              {s.holeNumber}
            </text>
          ))}

          {sorted.map((s, i) => {
            if (s.par < 4 || s.fairwayHit === null) return null
            return <g key={`fir-${s.holeNumber}`}>{firIcon(xScale(i), h - pad.bottom + 16, s.fairwayHit === true)}</g>
          })}

          {sorted.map((s, i) => {
            if (s.gir === null) return null
            return <g key={`gir-${s.holeNumber}`}>{girIcon(xScale(i), h - pad.bottom + 30, s.gir === true)}</g>
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-[3px] rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
          <span>Score vs Par</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-[3px] rounded-full bg-purple-600 opacity-60" />
          <span>Putts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-[3px] rounded-full bg-gray-400" style={{ borderTop: '1px dashed #9ca3af' }} />
          <span>Trend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg viewBox="0 0 10 10" className="w-3 h-3"><path d="M5,0 L8,4 L6.5,3.5 L9,7 L1,7 L3.5,3.5 L2,4 Z" fill="#22c55e" /><rect x="4.2" y="7" width="1.6" height="2" fill="#166534" /></svg>
          <span>FIR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg viewBox="0 0 8 9" className="w-3 h-3"><ellipse cx="4" cy="6" rx="4" ry="2.5" fill="#22c55e" /><line x1="4" y1="0" x2="4" y2="5" stroke="#166534" strokeWidth="0.8" /><path d="M4,0 L7.5,1.5 L4,3 Z" fill="#dc2626" /></svg>
          <span>GIR</span>
        </div>
      </div>
    </div>
  )
}
