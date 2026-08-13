'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  SCORE_STYLE as SHARED_SCORE_STYLE,
  getScoreType as getSharedScoreType,
  type ScoreType as SharedScoreType,
} from '@/components/scorecard/detail/score-styles'
import { ScorecardStats } from '@/components/scorecard/detail/ScorecardStats'

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

type ScoreType = SharedScoreType | 'empty'

function getScoreType(strokes: number | undefined, par: number): ScoreType {
  if (strokes == null) return 'empty'
  return getSharedScoreType(strokes, par)
}

// The shared token-driven map plus this form's empty-cell state.
const SCORE_STYLE: Record<ScoreType, { cell: string; text: string; dot: string; doubleRing?: string }> = {
  ...SHARED_SCORE_STYLE,
  empty: { cell: 'border border-border/30 rounded', text: 'text-foreground', dot: 'var(--border)' },
}

// ─── Main Form ─────────────────────────────────────────────────────────────

export function ScorecardForm({ tournamentPlayerId, roundId, holes, existingScores, courseName }: Props) {
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    for (const s of existingScores) m[s.holeId] = s.strokes
    return m
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The POST can be refused (409 once the tournament is completed). Show why
  // rather than the "✓ Saved" pill, which would be a lie.
  async function readError(res: Response): Promise<string> {
    try {
      const j = await res.json()
      if (j?.error) return String(j.error)
    } catch { /* noop */ }
    return `Save failed (HTTP ${res.status})`
  }

  async function saveHole(holeId: string, strokes: number) {
    if (!strokes || strokes < 1) return
    setSaveStatus('saving')
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentPlayerId, holeId, roundId, strokes }),
    })
    if (!res.ok) {
      setSaveError(await readError(res))
      setSaveStatus('idle')
      return
    }
    setSaveError(null)
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
    const results = await Promise.all(
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
    const failed = results.find((r) => !r.ok)
    if (failed) {
      setSaveError(await readError(failed))
      setSaveStatus('idle')
      return
    }
    setSaveError(null)
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
        aria-label={`Hole ${h.number}, par ${h.par}, strokes`}
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
        className={`absolute inset-0 w-full h-full text-center bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-[inherit] text-sm font-bold [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${style.text}`}
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
        <span
          role="status"
          className={`text-xs font-semibold transition-all px-2.5 py-1 rounded-full border border-border bg-card text-muted-foreground ${
            saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {saveStatus === 'saving' ? 'Saving…' : '✓ Saved'}
        </span>
      </div>

      {saveError && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {saveError}
        </p>
      )}

      {/* Full-width scorecard table */}
      <p className="text-xs text-muted-foreground sm:hidden flex items-center gap-1 mb-1">
        <span aria-hidden="true">&larr;</span> Scroll to see all holes <span aria-hidden="true">&rarr;</span>
      </p>
      <div
        tabIndex={0}
        role="region"
        aria-label="Scorecard, scrolls horizontally"
        className="overflow-x-auto overscroll-x-contain rounded-xl border border-border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full text-sm border-collapse" style={{ minWidth: '560px' }}>
          <caption className="sr-only">Scorecard for {courseName}. Enter your strokes for each hole.</caption>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-primary)' }}>
              <th className="px-4 py-4 text-left text-xs font-bold text-primary-foreground uppercase tracking-widest w-20">Hole</th>
              {front.map((h) => {
                const scored = getScoreType(scores[h.id], h.par) !== 'empty'
                return (
                  <th key={h.id}
                    className={`py-4 text-center text-sm font-extrabold min-w-[2.75rem] transition-colors ${scored ? 'bg-primary-foreground/20 text-primary-foreground' : 'text-primary-foreground/80'}`}>
                    {h.number}
                  </th>
                )
              })}
              <th className="px-3 py-4 text-center text-xs font-bold text-primary-foreground/80 border-l border-primary-foreground/20 w-14 uppercase tracking-wider">Out</th>
              {back.map((h) => {
                const scored = getScoreType(scores[h.id], h.par) !== 'empty'
                return (
                  <th key={h.id}
                    className={`py-4 text-center text-sm font-extrabold min-w-[2.75rem] transition-colors ${scored ? 'bg-primary-foreground/20 text-primary-foreground' : 'text-primary-foreground/80'}`}>
                    {h.number}
                  </th>
                )
              })}
              {back.length > 0 && (
                <th className="px-3 py-4 text-center text-xs font-bold text-primary-foreground/80 border-l border-primary-foreground/20 w-14 uppercase tracking-wider">In</th>
              )}
              <th className="px-3 py-4 text-center text-xs font-bold text-primary-foreground border-l border-primary-foreground/20 w-16 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* Par row */}
            <tr className="border-b border-border bg-muted/20">
              <th scope="row" className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">Par</th>
              {front.map((h) => <td key={h.id} className="text-center py-2.5 text-sm font-semibold">{h.par}</td>)}
              <td className={summaryTd}>{frontPar}</td>
              {back.map((h) => <td key={h.id} className="text-center py-2.5 text-sm font-semibold">{h.par}</td>)}
              {back.length > 0 && <td className={summaryTd}>{backPar}</td>}
              <td className={totalTd}>{totalPar}</td>
            </tr>
            {/* HCP row */}
            <tr className="border-b border-border">
              <th scope="row" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">HCP</th>
              {front.map((h) => <td key={h.id} className="text-center py-2 text-xs text-muted-foreground">{h.handicap ?? '—'}</td>)}
              <td className={summaryTd + ' !font-normal text-muted-foreground text-xs'}>—</td>
              {back.map((h) => <td key={h.id} className="text-center py-2 text-xs text-muted-foreground">{h.handicap ?? '—'}</td>)}
              {back.length > 0 && <td className={summaryTd + ' !font-normal text-muted-foreground text-xs'}>—</td>}
              <td className={totalTd + ' !font-normal text-muted-foreground text-xs'}>—</td>
            </tr>
            {/* Score row */}
            <tr>
              <th scope="row" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">Score</th>
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
          <span className={`text-3xl font-heading ${diff < 0 ? 'text-score-birdie' : diff > 0 ? 'text-muted-foreground' : ''}`}>
            {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
          </span>
        </div>
      )}

      <Button
        onClick={saveAll}
        disabled={saveStatus === 'saving'}
        className="w-full text-primary-foreground font-semibold py-5"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {saveStatus === 'saving' ? 'Saving…' : 'Save Scorecard'}
      </Button>

      {/* Statistics */}
      <ScorecardStats
        scores={playedHoles.map((h) => ({ holeNumber: h.number, par: h.par, strokes: scores[h.id] }))}
      />
    </div>
  )
}
