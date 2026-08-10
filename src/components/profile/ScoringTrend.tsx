'use client'

import { BarChart } from '@/components/charts/bar-chart'
import { Bar } from '@/components/charts/bar'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'

/** Round-by-round score vs par on the profile Insights card.
 *  Client boundary: the chart tooltip takes a render function, which an
 *  RSC page cannot pass across the serialization boundary. */
export function ScoringTrend({ roundVsPars }: { roundVsPars: number[] }) {
  if (roundVsPars.length < 2) return null

  const data = roundVsPars.map((vsPar, i) => ({ name: `R${i + 1}`, vsPar }))

  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
        Scoring trend · full rounds vs par
      </p>
      <BarChart
        data={data}
        xDataKey="name"
        aspectRatio="5 / 2"
        margin={{ top: 12, right: 8, bottom: 32, left: 8 }}
      >
        <Grid horizontal highlightRowValues={[0]} />
        <Bar dataKey="vsPar" fill="var(--chart-1)" animate={false} />
        <BarXAxis />
        <ChartTooltip
          showDatePill={false}
          rows={(point) => [
            {
              color: 'var(--chart-1)',
              label: String(point.name),
              value: `${(point.vsPar as number) >= 0 ? '+' : ''}${point.vsPar} vs par`,
            },
          ]}
        />
      </BarChart>
    </div>
  )
}
