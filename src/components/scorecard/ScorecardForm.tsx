'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface HoleData {
  id: string
  number: number
  par: number
  handicap: number | null
  yards: number | null
}

interface ExistingScore {
  holeId: string
  strokes: number
  fairwayHit: boolean | null
  gir: boolean | null
  putts: number | null
}

interface Props {
  tournamentPlayerId: string
  roundId: string
  holes: HoleData[]
  existingScores: ExistingScore[]
  courseName: string
}

// ─── Score type helpers ────────────────────────────────────────────────────

type ScoreType = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double' | 'empty'

function getScoreType(strokes: number | undefined, par: number): ScoreType {
  if (strokes == null) return 'empty'
  const d = strokes - par
  if (d <= -2) return 'eagle'
  if (d === -1) return 'birdie'
  if (d === 0)  return 'par'
  if (d === 1)  return 'bogey'
  return 'double'
}

const SCORE_STYLE: Record<ScoreType, { cell: string; text: string; dot: string; doubleRing?: string }> = {
  eagle:  { cell: 'rounded-full border-2 border-red-500',               text: 'text-red-600',    dot: '#b8860b', doubleRing: 'rounded-full border-2 border-red-500' },
  birdie: { cell: 'rounded-full border-2 border-red-500',               text: 'text-red-600',    dot: '#dc2626' },
  par:    { cell: 'border border-border/40 rounded-sm',                  text: 'text-foreground', dot: '#6b7280' },
  bogey:  { cell: 'border-2 border-gray-700 rounded-none',              text: 'text-foreground', dot: '#374151' },
  double: { cell: 'border-2 border-gray-700 rounded-none',              text: 'text-gray-600',   dot: '#1f2937', doubleRing: 'border-2 border-gray-700 rounded-none' },
  empty:  { cell: 'border border-border/30 rounded',                    text: 'text-foreground', dot: '#d1d5db' },
}

// ─── SVG Donut Chart ───────────────────────────────────────────────────────

function DonutChart({ counts, total }: { counts: Record<string, number>; total: number }) {
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
            style={{ transition: 'all 0.5s ease' }}
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

// ─── Statistics Section ────────────────────────────────────────────────────

function ScorecardStats({ holes, scores }: { holes: HoleData[]; scores: Record<string, number> }) {
  const played = holes.filter((h) => scores[h.id] != null)
  const total = played.length
  if (total === 0) return null

  const counts: Record<string, number> = {
    eagle:  played.filter((h) => scores[h.id] - h.par <= -2).length,
    birdie: played.filter((h) => scores[h.id] - h.par === -1).length,
    par:    played.filter((h) => scores[h.id] - h.par === 0).length,
    bogey:  played.filter((h) => scores[h.id] - h.par === 1).length,
    double: played.filter((h) => scores[h.id] - h.par >= 2).length,
  }

  const statDefs = [
    { key: 'eagle',  label: 'Eagles',  border: 'border-yellow-400', bg: 'bg-yellow-50',  barColor: SCORE_STYLE.eagle.dot,  textColor: SCORE_STYLE.eagle.dot  },
    { key: 'birdie', label: 'Birdies', border: 'border-red-400',    bg: 'bg-red-50',     barColor: SCORE_STYLE.birdie.dot, textColor: SCORE_STYLE.birdie.dot },
    { key: 'par',    label: 'Pars',    border: 'border-gray-300',   bg: 'bg-gray-50',    barColor: SCORE_STYLE.par.dot,    textColor: SCORE_STYLE.par.dot    },
    { key: 'bogey',  label: 'Bogeys',  border: 'border-gray-500',   bg: 'bg-gray-100',   barColor: SCORE_STYLE.bogey.dot,  textColor: SCORE_STYLE.bogey.dot  },
    { key: 'double', label: 'Double+', border: 'border-gray-700',   bg: 'bg-gray-200',   barColor: SCORE_STYLE.double.dot, textColor: SCORE_STYLE.double.dot },
  ]

  return (
    <div className="space-y-5 pt-4 border-t border-border">
      <h3 className="text-2xl font-heading font-bold">Statistics</h3>
      <div className="flex flex-col sm:flex-row gap-8 items-start">
        {/* Donut + legend */}
        <div className="flex flex-col items-center gap-4 shrink-0">
          <DonutChart counts={counts} total={total} />
          <div className="space-y-1.5">
            {statDefs.filter((s) => counts[s.key] > 0).map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.barColor }} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-semibold ml-0.5">({counts[s.key]})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stat cards grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
          {statDefs.map((s) => {
            const count = counts[s.key]
            const pct = Math.round((count / total) * 100)
            return (
              <div key={s.key} className={`rounded-xl border-2 p-4 ${s.border} ${s.bg}`}>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <div className="flex items-end gap-1 mt-1">
                  <span className="text-4xl font-bold font-heading leading-none" style={{ color: s.textColor }}>{count}</span>
                  <span className="text-xs text-muted-foreground mb-1 ml-0.5">/ {total}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-white/60 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: s.barColor }} />
                </div>
                <p className="text-xs font-semibold mt-1" style={{ color: s.textColor }}>{pct}%</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Form ─────────────────────────────────────────────────────────────

export function ScorecardForm({ tournamentPlayerId, roundId, holes, existingScores, courseName }: Props) {
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    for (const s of existingScores) m[s.holeId] = s.strokes
    return m
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function saveHole(holeId: string, strokes: number) {
    if (!strokes || strokes < 1) return
    setSaveStatus('saving')
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentPlayerId, holeId, roundId, strokes }),
    })
    setSaveStatus('saved')
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
    saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
  }

  function scheduleHoleSave(holeId: string, strokes: number) {
    if (debounceTimers.current[holeId]) clearTimeout(debounceTimers.current[holeId])
    debounceTimers.current[holeId] = setTimeout(() => {
      delete debounceTimers.current[holeId]
      saveHole(holeId, strokes)
    }, 800)
  }

  function flushHoleSave(holeId: string, strokes: number) {
    if (debounceTimers.current[holeId]) {
      clearTimeout(debounceTimers.current[holeId])
      delete debounceTimers.current[holeId]
    }
    saveHole(holeId, strokes)
  }

  async function saveAll() {
    const pending = holes.filter((h) => scores[h.id])
    if (pending.length === 0) return
    setSaveStatus('saving')
    await Promise.all(
      pending.map((h) => {
        if (debounceTimers.current[h.id]) {
          clearTimeout(debounceTimers.current[h.id])
          delete debounceTimers.current[h.id]
        }
        return fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentPlayerId, holeId: h.id, roundId, strokes: scores[h.id] }),
        })
      })
    )
    setSaveStatus('saved')
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
    saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
  }

  const sorted = [...holes].sort((a, b) => a.number - b.number)
  const front  = sorted.filter((h) => h.number <= 9)
  const back   = sorted.filter((h) => h.number > 9)

  const frontPar   = front.reduce((s, h) => s + h.par, 0)
  const backPar    = back.reduce((s, h) => s + h.par, 0)
  const totalPar   = frontPar + backPar
  const frontScore = front.reduce((s, h) => s + (scores[h.id] ?? 0), 0)
  const backScore  = back.reduce((s, h) => s + (scores[h.id] ?? 0), 0)
  const totalScore = frontScore + backScore

  const playedHoles = sorted.filter((h) => scores[h.id] != null)
  const playedPar   = playedHoles.reduce((s, h) => s + h.par, 0)
  const playedScore = playedHoles.reduce((s, h) => s + scores[h.id], 0)
  const diff = playedHoles.length > 0 ? playedScore - playedPar : null

  function renderScoreCell(h: HoleData) {
    const s = scores[h.id]
    const type = getScoreType(s, h.par)
    const style = SCORE_STYLE[type]
    const inputEl = (
      <input
        type="number"
        min={1}
        max={20}
        value={s ?? ''}
        onChange={(e) => {
          const v = parseInt(e.target.value)
          if (!isNaN(v) && v > 0) {
            setScores((prev) => ({ ...prev, [h.id]: v }))
            scheduleHoleSave(h.id, v)
          } else if (e.target.value === '') {
            setScores((prev) => { const n = { ...prev }; delete n[h.id]; return n })
            if (debounceTimers.current[h.id]) {
              clearTimeout(debounceTimers.current[h.id])
              delete debounceTimers.current[h.id]
            }
          }
        }}
        onBlur={(e) => {
          const v = parseInt(e.target.value)
          if (!isNaN(v) && v > 0) flushHoleSave(h.id, v)
        }}
        className={`absolute inset-0 w-full h-full text-center bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-inset rounded-[inherit] text-sm font-bold [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${style.text}`}
      />
    )
    return (
      <td key={h.id} className="px-0.5 py-3 text-center">
        {style.doubleRing ? (
          <div className={`w-12 h-12 mx-auto flex items-center justify-center p-0.5 ${style.doubleRing}`}>
            <div className={`w-full h-full flex items-center justify-center relative font-bold ${style.cell}`}>
              {inputEl}
            </div>
          </div>
        ) : (
          <div className={`w-10 h-10 mx-auto flex items-center justify-center relative font-bold ${style.cell}`}>
            {inputEl}
          </div>
        )}
      </td>
    )
  }

  const summaryTd = 'px-3 py-3 text-center text-sm font-bold bg-[var(--color-primary)]/8 border-l border-[var(--color-primary)]/15'
  const totalTd   = 'px-3 py-3 text-center text-base font-extrabold bg-[var(--color-primary)]/12 border-l border-[var(--color-primary)]/15'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{courseName}</p>
        <span className={`text-xs font-semibold transition-all px-2.5 py-1 rounded-full ${
          saveStatus === 'idle'   ? 'opacity-0' :
          saveStatus === 'saving' ? 'bg-amber-100 text-amber-700 opacity-100' :
                                    'bg-green-100 text-green-700 opacity-100'
        }`}>
          {saveStatus === 'saving' ? 'Saving…' : '✓ Saved'}
        </span>
      </div>

      {/* Full-width scorecard table */}
      <p className="text-xs text-muted-foreground sm:hidden flex items-center gap-1 mb-1">
        <span aria-hidden="true">&larr;</span> Scroll to see all holes <span aria-hidden="true">&rarr;</span>
      </p>
      <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-border shadow-sm">
        <table className="w-full text-sm border-collapse" style={{ minWidth: '560px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-primary)' }}>
              <th className="px-4 py-4 text-left text-xs font-bold text-white uppercase tracking-widest w-20">Hole</th>
              {front.map((h) => {
                const scored = getScoreType(scores[h.id], h.par) !== 'empty'
                return (
                  <th key={h.id}
                    className={`py-4 text-center text-sm font-extrabold min-w-[2.75rem] transition-colors ${scored ? 'bg-white/20 text-white' : 'text-white/80'}`}>
                    {h.number}
                  </th>
                )
              })}
              <th className="px-3 py-4 text-center text-xs font-bold text-white/70 border-l border-white/20 w-14 uppercase tracking-wider">Out</th>
              {back.map((h) => {
                const scored = getScoreType(scores[h.id], h.par) !== 'empty'
                return (
                  <th key={h.id}
                    className={`py-4 text-center text-sm font-extrabold min-w-[2.75rem] transition-colors ${scored ? 'bg-white/20 text-white' : 'text-white/80'}`}>
                    {h.number}
                  </th>
                )
              })}
              {back.length > 0 && (
                <th className="px-3 py-4 text-center text-xs font-bold text-white/70 border-l border-white/20 w-14 uppercase tracking-wider">In</th>
              )}
              <th className="px-3 py-4 text-center text-xs font-bold text-white border-l border-white/20 w-16 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* Par row */}
            <tr className="border-b border-border bg-muted/20">
              <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Par</td>
              {front.map((h) => <td key={h.id} className="text-center py-2.5 text-sm font-semibold">{h.par}</td>)}
              <td className={summaryTd}>{frontPar}</td>
              {back.map((h) => <td key={h.id} className="text-center py-2.5 text-sm font-semibold">{h.par}</td>)}
              {back.length > 0 && <td className={summaryTd}>{backPar}</td>}
              <td className={totalTd}>{totalPar}</td>
            </tr>
            {/* HCP row */}
            <tr className="border-b border-border">
              <td className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">HCP</td>
              {front.map((h) => <td key={h.id} className="text-center py-2 text-xs text-muted-foreground">{h.handicap ?? '—'}</td>)}
              <td className={summaryTd + ' !font-normal text-muted-foreground text-xs'}>—</td>
              {back.map((h) => <td key={h.id} className="text-center py-2 text-xs text-muted-foreground">{h.handicap ?? '—'}</td>)}
              {back.length > 0 && <td className={summaryTd + ' !font-normal text-muted-foreground text-xs'}>—</td>}
              <td className={totalTd + ' !font-normal text-muted-foreground text-xs'}>—</td>
            </tr>
            {/* Score row */}
            <tr>
              <td className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Score</td>
              {front.map(renderScoreCell)}
              <td className={summaryTd + ' text-base'}>{frontScore > 0 ? frontScore : '—'}</td>
              {back.map(renderScoreCell)}
              {back.length > 0 && <td className={summaryTd + ' text-base'}>{backScore > 0 ? backScore : '—'}</td>}
              <td className={totalTd}>{totalScore > 0 ? totalScore : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Score summary */}
      {diff !== null && (
        <div className="flex items-center justify-end gap-4">
          <span className="text-sm text-muted-foreground">
            {playedHoles.length} hole{playedHoles.length !== 1 ? 's' : ''} · {playedScore} strokes
          </span>
          <span className={`text-3xl font-bold font-heading ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-muted-foreground' : ''}`}>
            {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
          </span>
        </div>
      )}

      <Button
        onClick={saveAll}
        disabled={saveStatus === 'saving'}
        className="w-full text-white font-semibold py-5"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {saveStatus === 'saving' ? 'Saving…' : 'Save Scorecard'}
      </Button>

      {/* Statistics */}
      <ScorecardStats holes={holes} scores={scores} />
    </div>
  )
}
