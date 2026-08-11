import { formatGauge, topFinding, type Finding, type GaugeSpec } from '@/lib/round-stats'
import { InsightCallout } from '@/components/insight-callout'

/**
 * The insights stat sheet — a ruled comparison sheet, not a grid of cards.
 *
 * Every row states one measure, the player's figure, where that sits against the
 * peer baseline, and what the gap is worth in shots. The headline verdict is the
 * single most costly finding, because the question this section answers is "what
 * do I practise", not "what are my numbers".
 *
 * Server-renderable: no client boundary, no chart runtime. The gauge is one div.
 */

const tone = (kind: Finding['kind']) => (kind === 'strength' ? 'var(--success)' : 'var(--warning)')

/**
 * Where the player sits against the peer mark on a fixed track. Redundant with
 * the figures either side of it, so it is hidden from assistive tech rather than
 * described twice.
 */
function BaselineGauge({ spec, kind }: { spec: GaugeSpec; kind: Finding['kind'] }) {
  const frac = (n: number) => `${Math.max(0, Math.min(1, n / spec.max)) * 100}%`
  return (
    <div aria-hidden="true" className="relative h-1.5 my-2 rounded-full bg-muted">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: frac(spec.value), backgroundColor: tone(kind) }}
      />
      {/* The peer mark: a gold hairline, per the Operate rule that gold is a rule. */}
      <div
        className="absolute -top-1 -bottom-1 w-px"
        style={{ left: frac(spec.peer), backgroundColor: 'var(--gold-ink)' }}
      />
    </div>
  )
}

function SheetRow({ finding }: { finding: Finding }) {
  const g = finding.gauge
  if (!g) return null
  const signed = `${finding.impact >= 0 ? '+' : '−'}${Math.abs(finding.impact).toFixed(1)}`
  return (
    <div className="py-3 border-b border-border last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {finding.area}
        </span>
        <span className="tabular-data text-lg font-bold leading-none">
          {formatGauge(g.value, g.format)}
        </span>
      </div>

      <BaselineGauge spec={g} kind={finding.kind} />

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">
          Benchmark {formatGauge(g.peer, g.format)}
          {g.lowerIsBetter ? ' or fewer' : ' or better'}
        </span>
        <span className="tabular-data text-xs font-bold" style={{ color: tone(finding.kind) }}>
          {signed} <span className="font-normal text-muted-foreground">shots</span>
        </span>
      </div>
    </div>
  )
}

export function StatSheet({
  findings,
  heading = 'Insights',
  handicap,
  divided = true,
  children,
}: {
  findings: Finding[]
  heading?: string
  /** Shown so it is obvious which peer group the benchmarks describe. */
  handicap: number
  /** Rule above the heading. Off when the sheet already sits in its own card. */
  divided?: boolean
  /** Rendered under the sheet — the par-type chart on the round card. */
  children?: React.ReactNode
}) {
  if (findings.length === 0 && !children) return null

  const verdict = topFinding(findings)
  const rows = findings.filter((f) => f.gauge)
  const notes = findings.filter((f) => !f.gauge)

  return (
    <section className={`space-y-4 ${divided ? 'pt-4 border-t border-border' : ''}`}>
      <h3 className="text-2xl font-heading font-bold">{heading}</h3>

      {verdict && (
        <div>
          <p className="font-heading text-xl sm:text-2xl font-bold leading-snug text-balance">
            {verdict.headline}
          </p>
          <p className="text-sm text-muted-foreground mt-1.5">{verdict.message}</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4">
          {rows.map((f) => (
            <SheetRow key={f.area} finding={f} />
          ))}
        </div>
      )}

      {children}

      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((f) => (
            <InsightCallout key={f.area} kind={f.kind} area={f.area} message={f.headline} />
          ))}
        </div>
      )}

      {rows.length > 0 && (
        // Required by PRODUCT.md "Evidence on Hand": these are published third-party
        // figures, never YourMajor's own data, and must never be presented as such.
        <p className="text-[11px] text-muted-foreground">
          Benchmarks are typical figures for a {Math.round(handicap)}-handicap from public
          amateur shot-tracking data (Shot Scope, Arccos), not YourMajor averages.
        </p>
      )}
    </section>
  )
}
