'use client'

import { useState } from 'react'
import { Undo2 } from 'lucide-react'

export interface PlayedPowerup {
  playerPowerupId: string
  powerupName: string
  powerupType: 'BOOST' | 'ATTACK'
  /** Who played it. */
  activatorName: string
  /** Who it landed on, for attacks. */
  targetName: string | null
  roundNumber: number | null
  /** Hole on the card that the effect applies to. */
  holeNumber: number | null
  scoreModifier: number | null
  /** ACTIVE = a multi-hole card still running. */
  status: string
}

interface Props {
  tournamentId: string
  played: PlayedPowerup[]
}

/**
 * Lets an admin take back a powerup a player activated by mistake.
 *
 * Players can undo their own cards from live scoring, but only while the
 * outcome is still unknown — once the hole is scored the card locks, so that
 * undo cannot be used to shop for a better result. This panel is the admin
 * escalation past that lock, mirroring how score corrections already work
 * (see src/lib/play-round.ts).
 */
export function PlayedPowerupsPanel({ tournamentId, played }: Props) {
  const [rows, setRows] = useState(played)
  const [undoingId, setUndoingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [undoneCount, setUndoneCount] = useState(0)

  async function undo(row: PlayedPowerup) {
    setUndoingId(row.playerPowerupId)
    setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/powerups/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerPowerupId: row.playerPowerupId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Undo failed (HTTP ${res.status})`)
        return
      }
      // Drop it from the list rather than refetching the page — the row is
      // gone either way and the admin usually has several to work through.
      setRows((prev) => prev.filter((r) => r.playerPowerupId !== row.playerPowerupId))
      setUndoneCount((n) => n + 1)
    } catch {
      setError('Undo failed — no connection.')
    } finally {
      setUndoingId(null)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-heading">Played powerups</h2>
          <p className="text-sm text-muted-foreground">
            Take back a card a player activated by mistake. Players can undo their own until the
            hole is scored; after that it has to come through here.
          </p>
        </div>
        {undoneCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {undoneCount} returned to {undoneCount === 1 ? 'its owner' : 'their owners'}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No powerups have been played yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Card</th>
                <th className="py-2 pr-3 font-semibold">Played by</th>
                <th className="py-2 pr-3 font-semibold">On</th>
                <th className="py-2 pr-3 font-semibold">Where</th>
                <th className="py-2 pr-3 font-semibold text-right">Effect</th>
                <th className="py-2 font-semibold sr-only">Undo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.playerPowerupId} className="border-t border-border/40">
                  <td className="py-2 pr-3">
                    <span className="font-semibold">{r.powerupName}</span>
                    {r.status === 'ACTIVE' && (
                      <span className="ml-2 text-xs text-muted-foreground">still running</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{r.activatorName}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.targetName ?? '—'}</td>
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                    {r.roundNumber !== null ? `R${r.roundNumber}` : '—'}
                    {r.holeNumber !== null ? ` · H${r.holeNumber}` : ''}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">
                    {r.scoreModifier === null
                      ? <span className="text-muted-foreground">pending</span>
                      : `${r.scoreModifier > 0 ? '+' : ''}${r.scoreModifier}`}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => undo(r)}
                      disabled={undoingId === r.playerPowerupId}
                      aria-label={`Take back ${r.powerupName} from ${r.activatorName}`}
                      className="tap-44 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-40"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      {undoingId === r.playerPowerupId ? 'Undoing…' : 'Undo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
