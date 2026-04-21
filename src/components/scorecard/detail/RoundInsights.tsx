interface HoleScore {
  holeNumber: number
  par: number
  strokes: number
  hasScore: boolean
  putts?: number | null
  fairwayHit?: boolean | null
  gir?: boolean | null
}

export function RoundInsights({ holes }: { holes: HoleScore[] }) {
  const scored = holes.filter(h => h.hasScore)
  if (scored.length < 9) return null

  const expectedPuttsPerHole = 2.0
  const holesWithPutts = scored.filter(s => s.putts !== null && s.putts !== undefined)
  const totalPutts = holesWithPutts.reduce((sum, s) => sum + (s.putts ?? 0), 0)
  const avgPutts = holesWithPutts.length > 0 ? totalPutts / holesWithPutts.length : 0
  const puttsDiff = avgPutts - expectedPuttsPerHole
  const totalPuttStrokesGained = holesWithPutts.length > 0 ? -(puttsDiff * holesWithPutts.length) : 0

  const fairwayHoles = scored.filter(s => s.par >= 4 && s.fairwayHit !== null)
  const fairwaysHit = fairwayHoles.filter(s => s.fairwayHit === true)
  const fairwaysMissed = fairwayHoles.filter(s => s.fairwayHit === false)
  const fairwayPct = fairwayHoles.length > 0 ? (fairwaysHit.length / fairwayHoles.length) * 100 : 0

  const avgScoreOnFairway = fairwaysHit.length > 0
    ? fairwaysHit.reduce((sum, s) => sum + (s.strokes - s.par), 0) / fairwaysHit.length
    : null
  const avgScoreOffFairway = fairwaysMissed.length > 0
    ? fairwaysMissed.reduce((sum, s) => sum + (s.strokes - s.par), 0) / fairwaysMissed.length
    : null

  const girHoles = scored.filter(s => s.gir !== null)
  const girHit = girHoles.filter(s => s.gir === true)
  const girMissed = girHoles.filter(s => s.gir === false)
  const girPct = girHoles.length > 0 ? (girHit.length / girHoles.length) * 100 : 0

  const avgScoreOnGir = girHit.length > 0
    ? girHit.reduce((sum, s) => sum + (s.strokes - s.par), 0) / girHit.length
    : null
  const avgScoreOffGir = girMissed.length > 0
    ? girMissed.reduce((sum, s) => sum + (s.strokes - s.par), 0) / girMissed.length
    : null

  const par3s = scored.filter(s => s.par === 3)
  const par4s = scored.filter(s => s.par === 4)
  const par5s = scored.filter(s => s.par === 5)
  const avgVsParByType = (holes: typeof scored) =>
    holes.length > 0 ? holes.reduce((sum, s) => sum + (s.strokes - s.par), 0) / holes.length : null

  const par3Avg = avgVsParByType(par3s)
  const par4Avg = avgVsParByType(par4s)
  const par5Avg = avgVsParByType(par5s)

  const weaknesses: Array<{ area: string; impact: number; message: string }> = []

  if (totalPuttStrokesGained < -1) {
    weaknesses.push({
      area: 'Putting',
      impact: totalPuttStrokesGained,
      message: `Averaging ${avgPutts.toFixed(1)} putts/hole (${Math.abs(puttsDiff).toFixed(1)} above expected). Costing ~${Math.abs(totalPuttStrokesGained).toFixed(1)} strokes this round.`,
    })
  }

  if (avgScoreOnFairway !== null && avgScoreOffFairway !== null && fairwaysMissed.length >= 3) {
    const impact = (avgScoreOffFairway - avgScoreOnFairway) * fairwaysMissed.length
    if (impact > 1) {
      weaknesses.push({
        area: 'Off the Tee',
        impact: -impact,
        message: `When missing fairways, scoring ${avgScoreOffFairway.toFixed(1)} vs par vs ${avgScoreOnFairway.toFixed(1)} when hitting. Missed ${fairwaysMissed.length} fairways cost ~${impact.toFixed(1)} strokes.`,
      })
    }
  }

  if (avgScoreOffGir !== null && girMissed.length >= 3 && avgScoreOffGir > 1) {
    weaknesses.push({
      area: 'Approach',
      impact: -(avgScoreOffGir * girMissed.length),
      message: `Missed ${girMissed.length} greens. When missing GIR, averaging +${avgScoreOffGir.toFixed(1)} vs par. Finding more greens would save ~${(avgScoreOffGir * girMissed.length - (avgScoreOnGir ?? 0) * girMissed.length).toFixed(1)} strokes.`,
    })
  }

  const strengths: Array<{ area: string; message: string }> = []

  if (totalPuttStrokesGained > 0.5) {
    strengths.push({
      area: 'Putting',
      message: `Excellent putting — averaging ${avgPutts.toFixed(1)} putts/hole, gaining ${totalPuttStrokesGained.toFixed(1)} strokes vs expected.`,
    })
  }

  if (fairwayPct >= 70 && fairwayHoles.length >= 8) {
    strengths.push({
      area: 'Accuracy',
      message: `Hitting ${fairwayPct.toFixed(0)}% of fairways. Strong off the tee.`,
    })
  }

  if (girPct >= 55 && girHoles.length >= 10) {
    strengths.push({
      area: 'Approach',
      message: `Hitting ${girPct.toFixed(0)}% greens in regulation. Solid iron play.`,
    })
  }

  if (par5Avg !== null && par5Avg < 0 && par5s.length >= 2) {
    strengths.push({
      area: 'Par 5s',
      message: `Averaging ${par5Avg > 0 ? '+' : ''}${par5Avg.toFixed(1)} on par 5s — taking advantage of scoring holes.`,
    })
  }

  if (weaknesses.length === 0 && strengths.length === 0) return null

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <h3 className="text-2xl font-heading font-bold">Insights</h3>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Par 3s', avg: par3Avg, count: par3s.length },
          { label: 'Par 4s', avg: par4Avg, count: par4s.length },
          { label: 'Par 5s', avg: par5Avg, count: par5s.length },
        ].filter(d => d.count > 0).map(d => (
          <div key={d.label} className="rounded-lg border border-border p-3 text-center">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{d.label}</p>
            <p className={`text-lg font-bold font-heading ${
              d.avg !== null && d.avg < 0 ? 'text-red-600' : 'text-foreground'
            }`}>
              {d.avg !== null ? (d.avg >= 0 ? '+' : '') + d.avg.toFixed(2) : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">avg vs par</p>
          </div>
        ))}
      </div>

      {strengths.length > 0 && (
        <div className="space-y-2">
          {strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-green-200 bg-green-50">
              <span className="text-green-600 text-sm mt-0.5">+</span>
              <div>
                <p className="text-xs font-bold text-green-800">{s.area}</p>
                <p className="text-xs text-green-700 mt-0.5">{s.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {weaknesses.length > 0 && (
        <div className="space-y-2">
          {weaknesses.sort((a, b) => a.impact - b.impact).map((w, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50">
              <span className="text-amber-600 text-sm mt-0.5">!</span>
              <div>
                <p className="text-xs font-bold text-amber-800">{w.area}</p>
                <p className="text-xs text-amber-700 mt-0.5">{w.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
