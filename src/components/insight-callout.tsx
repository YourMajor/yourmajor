/** Strength / weakness callout row shared by the scorecard RoundInsights
 *  and the profile Insights card. Tokens only — success/warning registers,
 *  never raw Tailwind color-scale classes (DESIGN.md Operate Surface). */
export function InsightCallout({
  kind,
  area,
  message,
}: {
  kind: 'strength' | 'weakness'
  area: string
  message: string
}) {
  const glyph = kind === 'strength' ? '+' : '!'
  const tone = kind === 'strength' ? 'var(--success)' : 'var(--warning)'
  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border"
      style={{
        borderColor: `color-mix(in oklch, ${tone} 35%, transparent)`,
        background: `color-mix(in oklch, ${tone} 8%, var(--card))`,
      }}
    >
      <span className="text-sm mt-0.5 font-bold" style={{ color: tone }}>
        {glyph}
      </span>
      <div>
        <p
          className="text-xs font-bold"
          style={{ color: `color-mix(in oklch, ${tone} 70%, var(--foreground))` }}
        >
          {area}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
      </div>
    </div>
  )
}
