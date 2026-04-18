import { SCORE_STYLE } from './score-styles'

export function DonutChart({ counts, total }: { counts: Record<string, number>; total: number }) {
  const r = 46, size = 120, c = size / 2
  const circ = 2 * Math.PI * r

  const segs = [
    { key: 'eagle',  color: SCORE_STYLE.eagle.dot  },
    { key: 'birdie', color: SCORE_STYLE.birdie.dot },
    { key: 'par',    color: SCORE_STYLE.par.dot    },
    { key: 'bogey',  color: SCORE_STYLE.bogey.dot  },
    { key: 'double', color: SCORE_STYLE.double.dot },
  ].filter((s) => (counts[s.key] ?? 0) > 0)

  let cum = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
      {segs.map((seg) => {
        const len = (counts[seg.key] / total) * circ
        const off = circ * 0.25 - cum
        cum += len
        return (
          <circle key={seg.key} cx={c} cy={c} r={r}
            fill="none" stroke={seg.color} strokeWidth="14"
            strokeDasharray={`${len} ${circ}`} strokeDashoffset={off}
          />
        )
      })}
      <text x={c} y={c + 7} textAnchor="middle"
        style={{ fontSize: '20px', fontWeight: 700, fill: '#111827' }}>
        {total}
      </text>
    </svg>
  )
}
