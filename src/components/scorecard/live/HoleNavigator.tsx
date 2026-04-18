'use client'

import { useRef, useEffect } from 'react'
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

const PILL_BG: Record<ScoreType, string> = {
  eagle: 'bg-red-500 text-white',
  birdie: 'bg-red-500 text-white',
  par: 'bg-white/30 text-white',
  bogey: 'bg-gray-900 text-white',
  double: 'bg-gray-900 text-white',
  empty: 'bg-transparent text-white/40',
}

interface HoleNavigatorProps {
  holes: HoleData[]
  scores: Record<string, HoleScore>
  currentIndex: number
  onSelect: (index: number) => void
}

export function HoleNavigator({
  holes,
  scores,
  currentIndex,
  onSelect,
}: HoleNavigatorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  // Auto-scroll current hole into view
  useEffect(() => {
    const pill = pillRefs.current.get(currentIndex)
    if (pill) {
      pill.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
    }
  }, [currentIndex])

  return (
    <div
      ref={containerRef}
      className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none touch-pan-x"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {holes.map((hole, idx) => {
        const score = scores[hole.id]
        const type = getScoreType(score?.strokes ?? null, hole.par)
        const isCurrent = idx === currentIndex
        const hasScore = type !== 'empty'

        const hasPowerup = (score?.activePowerups?.length ?? 0) > 0
        const hasAttack = (score?.attacksReceived?.length ?? 0) > 0
        const powerupRing = hasPowerup ? 'ring-2 ring-purple-500' : hasAttack ? 'ring-2 ring-red-700' : ''

        return (
          <button
            key={hole.id}
            ref={(el) => {
              if (el) pillRefs.current.set(idx, el)
            }}
            type="button"
            onClick={() => onSelect(idx)}
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all touch-manipulation
              ${hasScore ? PILL_BG[type] : 'border border-white/40 text-white/70'}
              ${isCurrent ? 'ring-2 ring-[var(--color-accent,oklch(0.72_0.11_78))] scale-110' : powerupRing}
            `}
          >
            {hole.number}
          </button>
        )
      })}
    </div>
  )
}
