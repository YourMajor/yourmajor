'use client'

import { formatVsPar } from '@/lib/scoring-utils'
import type { HoleData, HoleScore } from './useLiveScoringState'

type ScoreType = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double' | 'empty'

function getScoreType(strokes: number | null, par: number): ScoreType {
  if (strokes == null) return 'empty'
  const d = strokes - par
  if (d <= -2) return 'eagle'
  if (d === -1) return 'birdie'
  if (d === 0) return 'par'
  if (d === 1) return 'bogey'
  return 'double'
}

const CELL_STYLE: Record<ScoreType, string> = {
  eagle: 'text-[var(--color-primary)] border-2 border-[var(--color-primary)] rounded-full font-extrabold',
  birdie: 'text-[var(--color-primary)] border-2 border-[var(--color-primary)] rounded-full',
  par: 'text-foreground',
  bogey: 'text-foreground border border-foreground/40',
  double: 'text-foreground/70 border-2 border-foreground/40',
  empty: 'text-muted-foreground',
}

interface RoundSummaryProps {
  holes: HoleData[]
  scores: Record<string, HoleScore>
  courseName: string
  playerName?: string
  onHoleSelect?: (index: number) => void
}

export function RoundSummary({ holes, scores, courseName, playerName, onHoleSelect }: RoundSummaryProps) {
  const front = holes.filter((h) => h.number <= 9)
  const back = holes.filter((h) => h.number > 9)

  function nineStats(nineHoles: HoleData[]) {
    let ninePar = 0
    let playedPar = 0
    let totalStrokes = 0
    let played = 0
    for (const h of nineHoles) {
      ninePar += h.par
      const s = scores[h.id]
      if (s?.strokes !== null && s?.strokes !== undefined) {
        totalStrokes += s.strokes
        playedPar += h.par
        played++
      }
    }
    return { ninePar, playedPar, totalStrokes, played }
  }

  const frontStats = nineStats(front)
  const backStats = nineStats(back)
  const coursePar = frontStats.ninePar + backStats.ninePar
  const playedPar = frontStats.playedPar + backStats.playedPar
  const totalStrokes = frontStats.totalStrokes + backStats.totalStrokes
  const totalPlayed = frontStats.played + backStats.played
  const diff = totalPlayed > 0 ? totalStrokes - playedPar : null

  // Stat aggregates
  let fairwaysHit = 0
  let fairwaysTotal = 0
  let girHit = 0
  let girTotal = 0
  let totalPutts = 0
  let puttsHoles = 0

  for (const h of holes) {
    const s = scores[h.id]
    if (!s || s.strokes === null) continue
    if (h.par > 3) {
      fairwaysTotal++
      if (s.fairwayHit) fairwaysHit++
    }
    girTotal++
    if (s.gir) girHit++
    if (s.putts !== null) {
      totalPutts += s.putts
      puttsHoles++
    }
  }

  function handleHoleClick(holeNumber: number) {
    if (!onHoleSelect) return
    const idx = holes.findIndex((h) => h.number === holeNumber)
    if (idx !== -1) onHoleSelect(idx)
  }

  function renderNineTable(nineHoles: HoleData[], label: string, stats: ReturnType<typeof nineStats>) {
    return (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ backgroundColor: 'var(--color-primary)' }}>
            <th className="py-2.5 px-2 text-left text-[10px] font-bold text-white uppercase tracking-widest w-14">
              Hole
            </th>
            {nineHoles.map((h) => (
              <th key={h.id} className="py-2.5 px-0.5 text-center text-xs font-extrabold text-white w-8">
                {h.number}
              </th>
            ))}
            <th className="py-2.5 px-2 text-center text-[10px] font-bold text-white/80 uppercase tracking-widest w-12 border-l border-white/20">
              {label}
            </th>
            <th className="py-2.5 px-2 text-center text-[10px] font-bold text-white/80 uppercase tracking-widest w-12">
              Tot
            </th>
          </tr>
        </thead>
        <tbody className="bg-background text-foreground">
          {/* Par row */}
          <tr className="border-b border-border">
            <td className="py-2 px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Par</td>
            {nineHoles.map((h) => (
              <td key={h.id} className="py-2 px-0.5 text-center text-xs font-semibold text-foreground">
                {h.par}
              </td>
            ))}
            <td className="py-2 px-2 text-center text-sm font-bold text-foreground border-l border-border">
              {stats.ninePar}
            </td>
            <td className="py-2 px-2 text-center text-sm font-bold text-foreground">
              {stats.ninePar}
            </td>
          </tr>
          {/* Score row */}
          <tr>
            <td className="py-2.5 px-1 text-[9px] font-bold text-muted-foreground">
              {playerName
                ? playerName.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
                : 'SC'}
            </td>
            {nineHoles.map((h) => {
              const s = scores[h.id]
              const strokes = s?.strokes ?? null
              const type = getScoreType(strokes, h.par)
              const hasPowerup = (s?.activePowerups?.length ?? 0) > 0
              const hasAttack = (s?.attacksReceived?.length ?? 0) > 0
              return (
                <td key={h.id} className="py-2.5 px-0.5 text-center">
                  <button
                    type="button"
                    onClick={() => handleHoleClick(h.number)}
                    className={`w-7 h-7 mx-auto flex items-center justify-center font-bold text-xs transition-transform active:scale-90 touch-manipulation relative ${CELL_STYLE[type]} ${onHoleSelect ? 'cursor-pointer' : ''}`}
                  >
                    {strokes ?? '-'}
                    {hasPowerup && (
                      <span className="absolute -top-1.5 -right-1.5 text-[11px] leading-none text-purple-600">&#9733;</span>
                    )}
                    {hasAttack && (
                      <span className="absolute -top-1.5 -right-1.5 text-[11px] leading-none text-red-600">&#9733;</span>
                    )}
                  </button>
                </td>
              )
            })}
            <td className="py-2.5 px-2 text-center text-sm font-bold text-foreground border-l border-border">
              {stats.played > 0 ? stats.totalStrokes : '-'}
            </td>
            <td className="py-2.5 px-2 text-center text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
              {stats.played > 0 ? stats.totalStrokes : '-'}
            </td>
          </tr>
        </tbody>
      </table>
    )
  }

  // Legend items
  const legendItems = [
    { label: 'Eagle', className: 'border-2 border-[var(--color-primary)] rounded-full' },
    { label: 'Birdie', className: 'border-2 border-[var(--color-primary)] rounded-full' },
    { label: 'Bogey', className: 'border border-foreground/40' },
    { label: 'D Bogey +', className: 'border-2 border-foreground/40' },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background text-foreground">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h3 className="text-lg font-heading font-bold text-foreground">
          Round Summary
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">{courseName}</p>
      </div>

      {/* Scorecard tables */}
      <div className="mx-4 rounded-xl border border-border overflow-hidden shadow-sm">
        {front.length > 0 && renderNineTable(front, 'Out', frontStats)}
        {back.length > 0 && (
          <div className="border-t-2" style={{ borderColor: 'var(--color-primary)' }}>
            {renderNineTable(back, 'In', backStats)}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 mt-3 flex items-center justify-center gap-4 flex-wrap">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-5 h-5 inline-flex items-center justify-center ${item.className}`} />
            <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mx-4 mt-4 flex items-center justify-between rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="text-center flex-1 py-3">
          <p className="text-[10px] text-white/70 uppercase tracking-wider">Gross</p>
          <p className="text-2xl font-heading font-bold text-white">
            {totalPlayed > 0 ? totalStrokes : '-'}
          </p>
        </div>
        <div className="w-px h-10 bg-white/20" />
        <div className="text-center flex-1 py-3">
          <p className="text-[10px] text-white/70 uppercase tracking-wider">Par</p>
          <p className="text-2xl font-heading font-bold text-white">{coursePar}</p>
        </div>
        <div className="w-px h-10 bg-white/20" />
        <div className="text-center flex-1 py-3">
          <p className="text-[10px] text-white/70 uppercase tracking-wider">vs Par</p>
          <p className={`text-2xl font-heading font-bold ${
            diff !== null && diff < 0 ? 'text-red-300' : 'text-white'
          }`}>
            {formatVsPar(diff)}
          </p>
        </div>
        <div className="w-px h-10 bg-white/20" />
        <div className="text-center flex-1 py-3">
          <p className="text-[10px] text-white/70 uppercase tracking-wider">Holes</p>
          <p className="text-2xl font-heading font-bold text-white">{totalPlayed}</p>
        </div>
      </div>

      {/* Stats */}
      {totalPlayed > 0 && (
        <div className="mx-4 mt-4 mb-4 grid grid-cols-3 gap-3">
          {fairwaysTotal > 0 && (
            <div className="rounded-xl border border-border p-3 text-center bg-card">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">FIR</p>
              <p className="text-lg font-bold text-foreground">
                {fairwaysHit}/{fairwaysTotal}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {Math.round((fairwaysHit / fairwaysTotal) * 100)}%
              </p>
            </div>
          )}
          {girTotal > 0 && (
            <div className="rounded-xl border border-border p-3 text-center bg-card">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">GIR</p>
              <p className="text-lg font-bold text-foreground">
                {girHit}/{girTotal}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {Math.round((girHit / girTotal) * 100)}%
              </p>
            </div>
          )}
          {puttsHoles > 0 && (
            <div className="rounded-xl border border-border p-3 text-center bg-card">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Putts</p>
              <p className="text-lg font-bold text-foreground">
                {(totalPutts / puttsHoles).toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground">avg/hole</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
