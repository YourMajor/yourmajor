'use client'

import { BarChart } from '@/components/charts/bar-chart'
import { Bar } from '@/components/charts/bar'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { StatSheet } from '@/components/insights/StatSheet'
import { computeRoundStats, statFindings } from '@/lib/round-stats'

interface HoleScore {
  holeNumber: number
  par: number
  strokes: number
  hasScore: boolean
  putts?: number | null
  fairwayHit?: boolean | null
  gir?: boolean | null
}

export function RoundInsights({ holes, handicap }: { holes: HoleScore[]; handicap: number }) {
  const scored = holes.filter((h) => h.hasScore)
  if (scored.length < 9) return null

  const stats = computeRoundStats(scored)
  const findings = statFindings(stats, handicap)

  const parTypeData = (
    [
      { name: 'Par 3s', rate: stats.parType.par3 },
      { name: 'Par 4s', rate: stats.parType.par4 },
      { name: 'Par 5s', rate: stats.parType.par5 },
    ] as const
  )
    .filter((d) => d.rate !== null)
    .map((d) => ({ name: d.name, avg: d.rate!.value, count: d.rate!.sample }))

  if (findings.length === 0 && parTypeData.length === 0) return null

  return (
    <StatSheet findings={findings} handicap={handicap}>
      {parTypeData.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            Scoring by par type · avg vs par
          </p>
          <BarChart
            data={parTypeData}
            xDataKey="name"
            aspectRatio="5 / 2"
            margin={{ top: 12, right: 8, bottom: 32, left: 8 }}
          >
            <Grid horizontal highlightRowValues={[0]} />
            <Bar dataKey="avg" fill="var(--chart-1)" animate={false} />
            <BarXAxis showAllLabels />
            <ChartTooltip
              showDatePill={false}
              rows={(point) => [
                {
                  color: 'var(--chart-1)',
                  label: String(point.name),
                  value: `${(point.avg as number) >= 0 ? '+' : ''}${(point.avg as number).toFixed(2)} vs par`,
                },
              ]}
            />
          </BarChart>
          <p className="tabular-data text-xs text-center space-x-3">
            {parTypeData.map((d) => (
              <span key={d.name} className="text-muted-foreground">
                {d.name}{' '}
                <span
                  className="font-bold"
                  style={{ color: d.avg < 0 ? 'var(--score-birdie)' : 'var(--foreground)' }}
                >
                  {(d.avg >= 0 ? '+' : '') + d.avg.toFixed(2)}
                </span>
              </span>
            ))}
          </p>
        </div>
      )}
    </StatSheet>
  )
}
