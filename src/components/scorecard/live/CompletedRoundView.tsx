'use client'

import Link from 'next/link'
import { ChevronLeft, Lock } from 'lucide-react'
import { RoundSummary } from './RoundSummary'
import type { ExistingScore, HoleData, HoleScore } from './useLiveScoringState'

interface Props {
  roundNumber: number
  holes: HoleData[]
  existingScores: ExistingScore[]
  courseName: string
  playerName: string
  backHref: string
  backLabel: string
  roundNav?: { current: number; rounds: Array<{ number: number; href: string }> }
  /** Shown to admins: where to correct a score on a finished card. */
  adminEditHref?: string
}

/**
 * A finished round in live scoring: the scorecard as it was posted, with no
 * way to change it. Admins correct finished cards from the admin scores page.
 */
export function CompletedRoundView({
  roundNumber,
  holes,
  existingScores,
  courseName,
  playerName,
  backHref,
  backLabel,
  roundNav,
  adminEditHref,
}: Props) {
  const scores: Record<string, HoleScore> = {}
  for (const s of existingScores) {
    scores[s.holeId] = {
      strokes: s.strokes,
      putts: s.putts ?? null,
      fairwayHit: s.fairwayHit,
      gir: s.gir,
      conceded: !!s.conceded,
      powerupUsed: false,
      activePowerups: [],
      attacksReceived: [],
      isDirty: false,
      isSaving: false,
      isExisting: true,
    }
  }
  const sortedHoles = [...holes].sort((a, b) => a.number - b.number)

  return (
    <div
      className="fixed top-0 left-0 w-screen h-[100dvh] z-50 flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--color-primary, oklch(0.40 0.11 160))' }}
    >
      <div className="shrink-0 bg-black/20 flex items-center justify-between pt-safe">
        <p className="px-4 py-3 text-sm font-semibold text-white">Round {roundNumber}</p>
        <Link
          href={backHref}
          className="shrink-0 flex items-center gap-1 px-4 py-3 text-xs font-semibold text-white/80 hover:text-white transition-colors touch-manipulation"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {backLabel}
        </Link>
      </div>

      {roundNav && (
        <nav aria-label="Round" className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 overflow-x-auto bg-black/20">
          {roundNav.rounds.map((r) => {
            const active = r.number === roundNav.current
            return (
              <Link
                key={r.number}
                href={r.href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 min-h-8 px-3 inline-flex items-center rounded-full text-xs font-bold transition-colors touch-manipulation ${
                  active ? 'bg-white text-black' : 'text-white/70 hover:text-white border border-white/20'
                }`}
              >
                Round {r.number}
              </Link>
            )
          })}
        </nav>
      )}

      <div
        role="status"
        className="shrink-0 bg-black/30 text-white text-xs font-semibold px-4 py-1.5 flex items-center gap-2"
      >
        <Lock className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
        <span className="truncate">Round complete — scores are locked.</span>
        {adminEditHref && (
          <Link href={adminEditHref} className="ml-auto shrink-0 underline underline-offset-2 opacity-90 hover:opacity-100">
            Edit as admin
          </Link>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <RoundSummary holes={sortedHoles} scores={scores} courseName={courseName} playerName={playerName} />
      </div>
    </div>
  )
}
