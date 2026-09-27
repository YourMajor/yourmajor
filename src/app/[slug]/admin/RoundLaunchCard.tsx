'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Flag, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface RoundLaunchRow {
  roundNumber: number
  open: boolean
  /** Human-readable status, e.g. "Opens Sun, Sep 27, 6:30 AM" */
  status: string
}

/**
 * Admin control for rounds after the first: shows whether each is open for
 * scoring and lets the admin launch one ahead of its automatic opening.
 */
export function RoundLaunchCard({ tournamentId, rounds }: { tournamentId: string; rounds: RoundLaunchRow[] }) {
  const router = useRouter()
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function launch(roundNumber: number) {
    setPending(roundNumber)
    setError(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/rounds/${roundNumber}/launch`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not launch the round.')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not launch the round.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="rounded-xl border border-border px-5 py-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Rounds</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Later rounds open for scoring 3 hours before the first tee time, or when you launch them.
        </p>
      </div>
      <ul className="space-y-2">
        {rounds.map((r) => (
          <li key={r.roundNumber} className="flex items-center gap-3">
            {r.open ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <Clock className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Round {r.roundNumber}</p>
              <p className="text-xs text-muted-foreground truncate">{r.status}</p>
            </div>
            {!r.open && (
              <Button size="sm" onClick={() => launch(r.roundNumber)} disabled={pending !== null}>
                {pending === r.roundNumber ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><Flag className="w-4 h-4 mr-1.5" /> Launch now</>
                )}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
