import { getScoreType, SCORE_STYLE } from './score-styles'

interface HoleScore {
  holeNumber: number
  par: number
  strokes: number
  handicapIndex: number | null
  hasScore: boolean
}

export function NineTable({
  holes,
  label,
  totalPar,
  totalGross,
  strokeHoles,
}: {
  holes: HoleScore[]
  label: string
  totalPar: number
  totalGross: number
  strokeHoles: Set<number>
}) {
  if (holes.length === 0) return null

  const summaryTd = 'px-1 py-2 text-center text-xs sm:text-sm font-bold bg-[var(--color-primary)]/8 border-l border-[var(--color-primary)]/15'

  return (
    <div className="rounded-xl border border-border shadow-sm overflow-hidden">
      <table className="w-full text-sm border-collapse table-fixed">
        <thead>
          <tr style={{ backgroundColor: 'var(--color-primary)' }}>
            <th className="px-1 sm:px-2 py-2 sm:py-3 text-left text-[9px] sm:text-[11px] font-bold text-white uppercase tracking-wider sm:tracking-widest w-[13%]">
              Hole
            </th>
            {holes.map((s) => (
              <th key={s.holeNumber} className="py-2 sm:py-3 text-center text-[11px] sm:text-xs font-extrabold text-white">
                {s.holeNumber}
              </th>
            ))}
            <th className="px-1 sm:px-2 py-2 sm:py-3 text-center text-[9px] sm:text-[11px] font-bold text-white/70 border-l border-white/20 uppercase tracking-wider w-[11%]">
              {label}
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Par row */}
          <tr className="border-b border-border bg-muted/20">
            <td className="px-1 sm:px-2 py-1.5 sm:py-2 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-widest text-muted-foreground">Par</td>
            {holes.map((s) => (
              <td key={s.holeNumber} className="text-center py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold">{s.par}</td>
            ))}
            <td className={summaryTd}>{totalPar}</td>
          </tr>
          {/* HCP row */}
          <tr className="border-b border-border">
            <td className="px-1 sm:px-2 py-1 sm:py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-widest text-muted-foreground">HCP</td>
            {holes.map((s) => (
              <td key={s.holeNumber} className="text-center py-1 sm:py-1.5 text-[9px] sm:text-[11px] text-muted-foreground">
                {s.handicapIndex ?? '—'}
              </td>
            ))}
            <td className={`${summaryTd} !font-normal text-muted-foreground text-[9px] sm:text-[11px]`}>—</td>
          </tr>
          {/* Score row */}
          <tr>
            <td className="px-1 sm:px-2 py-2 sm:py-2.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-widest text-muted-foreground">Score</td>
            {holes.map((s) => {
              if (!s.hasScore) {
                return (
                  <td key={s.holeNumber} className="py-2 sm:py-2.5 text-center">
                    <div className="size-6 sm:size-8 mx-auto flex items-center justify-center text-[11px] sm:text-xs text-muted-foreground/40">
                      —
                    </div>
                  </td>
                )
              }
              const type = getScoreType(s.strokes, s.par)
              const style = SCORE_STYLE[type]
              const receivesStroke = strokeHoles.has(s.holeNumber)
              return (
                <td key={s.holeNumber} className="py-2 sm:py-2.5 text-center">
                  {style.doubleRing ? (
                    <div className={`size-7 sm:size-10 mx-auto flex items-center justify-center p-0.5 ${style.doubleRing}`}>
                      <div className={`w-full h-full flex items-center justify-center relative font-bold text-[11px] sm:text-xs ${style.cell} ${style.text}`}>
                        {s.strokes}
                        {receivesStroke && (
                          <span className="absolute -top-1.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" title="Handicap stroke" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={`size-6 sm:size-8 mx-auto flex items-center justify-center relative font-bold text-[11px] sm:text-xs ${style.cell} ${style.text}`}>
                      {s.strokes}
                      {receivesStroke && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" title="Handicap stroke" />
                      )}
                    </div>
                  )}
                </td>
              )
            })}
            <td className={`${summaryTd} text-sm sm:text-base`}>{totalGross > 0 ? totalGross : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
