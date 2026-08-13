'use client'

import { useState, useRef } from 'react'
import { getScoreType, SCORE_STYLE } from '@/components/scorecard/detail/score-styles'

interface Hole { id: string; number: number; par: number }
interface Round { id: string; roundNumber: number; courseName: string; holes: Hole[] }
interface Player { id: string; name: string; handicap: number; scoresByRound: Record<string, Record<string, number>> }

interface Props {
  rounds: Round[]
  players: Player[]
}

// Sizing and spinner suppression are this grid's own; the score-type styling
// comes from the canonical map so admin, scorecard and play page agree.
const CELL_BASE =
  'w-10 h-10 sm:w-9 sm:h-8 text-center text-xs font-bold bg-transparent transition-all [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function scoreCellClass(strokes: number | null, par: number): string {
  if (strokes == null) return `${CELL_BASE} border border-border/30 rounded`
  const style = SCORE_STYLE[getScoreType(strokes, par)]
  return `${CELL_BASE} ${style.cell} ${style.text}`
}

export function AdminScorecardEditor({ rounds, players }: Props) {
  const [selectedRoundId, setSelectedRoundId] = useState(rounds[0]?.id ?? '')
  const [scores, setScores] = useState<Record<string, Record<string, Record<string, number>>>>(() => {
    const m: Record<string, Record<string, Record<string, number>>> = {}
    for (const p of players) m[p.id] = { ...p.scoresByRound }
    return m
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const round = rounds.find((r) => r.id === selectedRoundId)

  async function saveScore(tournamentPlayerId: string, roundId: string, holeId: string, strokes: number) {
    setSaveStatus('saving')
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentPlayerId, holeId, roundId, strokes }),
    })
    // A refused write (e.g. 409 on a completed tournament) must not read
    // "✓ Saved" — the grid would show a number the server never took.
    if (!res.ok) {
      let msg = `Save failed (HTTP ${res.status})`
      try { const j = await res.json(); if (j?.error) msg = String(j.error) } catch { /* noop */ }
      setSaveError(msg)
      setSaveStatus('idle')
      return
    }
    setSaveError(null)
    setSaveStatus('saved')
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
    saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }

  function scheduleScore(tpId: string, roundId: string, holeId: string, strokes: number) {
    const key = `${tpId}-${roundId}-${holeId}`
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => {
      delete debounceTimers.current[key]
      saveScore(tpId, roundId, holeId, strokes)
    }, 600)
  }

  function flushScore(tpId: string, roundId: string, holeId: string, strokes: number) {
    const key = `${tpId}-${roundId}-${holeId}`
    if (debounceTimers.current[key]) { clearTimeout(debounceTimers.current[key]); delete debounceTimers.current[key] }
    saveScore(tpId, roundId, holeId, strokes)
  }

  if (!round) return <p className="text-muted-foreground text-sm">No rounds configured.</p>

  const roundPar = round.holes.reduce((s, h) => s + h.par, 0)

  return (
    <div className="space-y-4">
      {/* Round tabs */}
      {rounds.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {rounds.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoundId(r.id)}
              className={`px-4 py-1.5 text-sm rounded-full border font-medium transition-colors ${
                r.id === selectedRoundId
                  ? 'text-primary-foreground border-transparent'
                  : 'border-border hover:bg-muted'
              }`}
              style={r.id === selectedRoundId ? { backgroundColor: 'var(--color-primary)' } : {}}
            >
              Round {r.roundNumber}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">{round.courseName} · Par {roundPar}</p>
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

      {/* Scroll hint for mobile */}
      <p className="text-xs text-muted-foreground sm:hidden flex items-center gap-1 mb-1">
        <span aria-hidden="true">&larr;</span> Scroll to see all holes <span aria-hidden="true">&rarr;</span>
      </p>
      <div className="relative">
      <div
        tabIndex={0}
        role="region"
        aria-label="Scorecard grid, scrolls horizontally"
        className="overflow-x-auto rounded-xl border border-border shadow-sm overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full text-sm border-collapse" style={{ minWidth: `${120 + round.holes.length * 44 + 80}px` }}>
          <caption className="sr-only">Scores for every player, round {round.roundNumber} at {round.courseName}.</caption>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-primary)' }}>
              <th className="px-3 py-3 text-left text-xs font-bold text-primary-foreground uppercase tracking-widest sticky left-0 z-10 min-w-[140px]"
                style={{ backgroundColor: 'var(--color-primary)' }}>
                Player
              </th>
              <th className="px-2 py-3 text-center text-xs font-bold text-primary-foreground/80 w-10">HCP</th>
              {round.holes.map((h) => (
                <th key={h.id} className="py-3 text-center text-xs font-bold text-primary-foreground min-w-[2.5rem]">{h.number}</th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-bold text-primary-foreground/80 w-16">Total</th>
              <th className="px-3 py-3 text-center text-xs font-bold text-primary-foreground/80 w-16">+/-</th>
            </tr>
            {/* Par row */}
            <tr className="bg-muted/30 border-b border-border">
              <th scope="row" className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/30">Par</th>
              <td className="px-2 py-1.5 text-center text-xs text-muted-foreground">—</td>
              {round.holes.map((h) => (
                <td key={h.id} className="py-1.5 text-center text-xs font-semibold text-muted-foreground">{h.par}</td>
              ))}
              <td className="px-3 py-1.5 text-center text-xs font-bold text-muted-foreground">{roundPar}</td>
              <td className="px-3 py-1.5 text-center text-xs text-muted-foreground">—</td>
            </tr>
          </thead>
          <tbody>
            {players.map((p, pi) => {
              const playerScores = scores[p.id]?.[round.id] ?? {}
              const total = round.holes.reduce((s, h) => s + (playerScores[h.id] ?? 0), 0)
              const playedPar = round.holes.filter(h => playerScores[h.id] != null).reduce((s, h) => s + h.par, 0)
              const diff = total > 0 ? total - playedPar : null

              return (
                <tr key={p.id}
                  className={`border-t border-border/30 ${pi % 2 === 1 ? 'bg-muted/10' : 'bg-card'}`}>
                  <td className={`px-3 py-2.5 text-sm font-semibold sticky left-0 z-10 ${pi % 2 === 1 ? 'bg-muted/10' : 'bg-card'}`}>
                    {p.name}
                  </td>
                  <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">{p.handicap}</td>
                  {round.holes.map((h) => {
                    const s = playerScores[h.id]
                    return (
                      <td key={h.id} className="py-2.5 text-center px-0.5">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          aria-label={`${p.name}, hole ${h.number}, par ${h.par}, strokes`}
                          value={s ?? ''}
                          onChange={(e) => {
                            const v = parseInt(e.target.value)
                            const valid = !isNaN(v) && v > 0
                            setScores((prev) => {
                              const n = { ...prev }
                              const playerRounds = { ...(n[p.id] ?? {}) }
                              const roundScores = { ...(playerRounds[round.id] ?? {}) }
                              if (valid) roundScores[h.id] = v
                              else delete roundScores[h.id]
                              playerRounds[round.id] = roundScores
                              n[p.id] = playerRounds
                              return n
                            })
                            if (valid) scheduleScore(p.id, round.id, h.id, v)
                          }}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value)
                            if (!isNaN(v) && v > 0) flushScore(p.id, round.id, h.id, v)
                          }}
                          className={scoreCellClass(s ?? null, h.par)}
                        />
                      </td>
                    )
                  })}
                  <td className="px-3 py-2.5 text-center font-bold text-sm">
                    {total > 0 ? total : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-center font-bold text-sm ${
                    diff === null ? 'text-muted-foreground' :
                    diff < 0 ? 'text-score-birdie' :
                    diff > 0 ? 'text-muted-foreground' : ''
                  }`}>
                    {diff === null ? '—' : diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </div>
      <p className="text-xs text-muted-foreground">Changes auto-save as you type. The leaderboard recalculates automatically.</p>
    </div>
  )
}
