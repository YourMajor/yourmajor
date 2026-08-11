import { SCORE_STYLE } from './score-styles'
import { DonutChart } from './DonutChart'

interface HoleScore {
  holeNumber: number
  par: number
  strokes: number
}

export function ScorecardStats({ scores }: { scores: HoleScore[] }) {
  const total = scores.length
  if (total === 0) return null

  const counts: Record<string, number> = {
    eagle:  scores.filter((s) => s.strokes - s.par <= -2).length,
    birdie: scores.filter((s) => s.strokes - s.par === -1).length,
    par:    scores.filter((s) => s.strokes - s.par === 0).length,
    bogey:  scores.filter((s) => s.strokes - s.par === 1).length,
    double: scores.filter((s) => s.strokes - s.par >= 2).length,
  }

  const statDefs = [
    { key: 'eagle',  label: 'Eagles',  tone: SCORE_STYLE.eagle.dot  },
    { key: 'birdie', label: 'Birdies', tone: SCORE_STYLE.birdie.dot },
    { key: 'par',    label: 'Pars',    tone: SCORE_STYLE.par.dot    },
    { key: 'bogey',  label: 'Bogeys',  tone: SCORE_STYLE.bogey.dot  },
    { key: 'double', label: 'Double+', tone: SCORE_STYLE.double.dot },
  ]

  return (
    <div className="space-y-5 pt-4 border-t border-border">
      <h3 className="text-2xl font-heading font-bold">Statistics</h3>
      <div className="flex flex-col sm:flex-row gap-8 items-start">
        <div className="flex flex-col items-center gap-4 shrink-0">
          <DonutChart counts={counts} total={total} />
          <div className="space-y-1.5">
            {statDefs.filter((s) => counts[s.key] > 0).map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.tone }} aria-hidden="true" />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-semibold ml-0.5">({counts[s.key]})</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
          {statDefs.map((s) => {
            const count = counts[s.key]
            const pct = Math.round((count / total) * 100)
            return (
              <div
                key={s.key}
                className="rounded-xl border-2 p-4"
                style={{
                  borderColor: `color-mix(in oklch, ${s.tone} 40%, var(--border))`,
                  background: `color-mix(in oklch, ${s.tone} 6%, var(--card))`,
                }}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <div className="flex items-end gap-1 mt-1">
                  <span className="text-4xl font-bold font-heading leading-none" style={{ color: s.tone }}>{count}</span>
                  <span className="text-xs text-muted-foreground mb-1 ml-0.5">/ {total}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.tone }} />
                </div>
                <p className="text-xs font-semibold mt-1" style={{ color: s.tone }}>{pct}%</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
