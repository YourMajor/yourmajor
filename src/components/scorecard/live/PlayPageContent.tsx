'use client'

import { useState, useEffect } from 'react'
import { ScorecardForm } from '@/components/scorecard/ScorecardForm'
import { LiveScoring } from './LiveScoring'
import { Smartphone, Table2 } from 'lucide-react'
import type { HoleData, ExistingScore } from './useLiveScoringState'

interface PlayPageContentProps {
  tournamentPlayerId: string
  roundId: string
  holes: HoleData[]
  existingScores: ExistingScore[]
  courseName: string
  powerupsEnabled: boolean
  teeName?: string
  teeColor?: string
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

export function PlayPageContent({
  tournamentPlayerId,
  roundId,
  holes,
  existingScores,
  courseName,
  powerupsEnabled,
  teeName,
  teeColor,
}: PlayPageContentProps) {
  const isMobile = useIsMobile()
  const [view, setView] = useState<'live' | 'table' | null>(null)

  // Default: mobile → live, desktop → table
  useEffect(() => {
    if (view === null) setView(isMobile ? 'live' : 'table')
  }, [isMobile, view])

  // Don't render until we know the view (avoids SSR mismatch)
  if (view === null) return null

  if (view === 'live') {
    return (
      <>
        <LiveScoring
          tournamentPlayerId={tournamentPlayerId}
          roundId={roundId}
          holes={holes}
          existingScores={existingScores}
          courseName={courseName}
          powerupsEnabled={powerupsEnabled}
          teeName={teeName}
          teeColor={teeColor}
        />
        {/* Float toggle button to switch to table view */}
        <button
          type="button"
          onClick={() => setView('table')}
          className="fixed top-3 right-3 z-50 p-2 rounded-full bg-black/30 text-white/70 hover:bg-black/50 transition-colors touch-manipulation"
          aria-label="Switch to table view"
        >
          <Table2 className="w-5 h-5" />
        </button>
      </>
    )
  }

  return (
    <div className="relative">
      {/* Toggle back to live view */}
      <button
        type="button"
        onClick={() => setView('live')}
        className="absolute top-0 right-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
      >
        <Smartphone className="w-3.5 h-3.5" />
        Live Scoring
      </button>

      <ScorecardForm
        tournamentPlayerId={tournamentPlayerId}
        roundId={roundId}
        holes={holes}
        existingScores={existingScores}
        courseName={courseName}
      />
    </div>
  )
}
