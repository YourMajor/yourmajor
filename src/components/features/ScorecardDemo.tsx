'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const HOLES = [
  { hole: 1, par: 4, score: 4 },
  { hole: 2, par: 3, score: 2 },
  { hole: 3, par: 5, score: 5 },
  { hole: 4, par: 4, score: 5 },
  { hole: 5, par: 4, score: 3 },
  { hole: 6, par: 3, score: 3 },
  { hole: 7, par: 5, score: 4 },
  { hole: 8, par: 4, score: 4 },
  { hole: 9, par: 4, score: 6 },
]

type ScoreType = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double'

function getScoreType(score: number, par: number): ScoreType {
  const diff = score - par
  if (diff <= -2) return 'eagle'
  if (diff === -1) return 'birdie'
  if (diff === 0) return 'par'
  if (diff === 1) return 'bogey'
  return 'double'
}

const SCORE_BADGE: Record<ScoreType, { label: string; cls: string }> = {
  eagle: { label: 'Eagle', cls: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40' },
  birdie: { label: 'Birdie', cls: 'bg-red-400/20 text-red-300 border-red-400/40' },
  par: { label: 'Par', cls: 'bg-white/10 text-white/80 border-white/20' },
  bogey: { label: 'Bogey', cls: 'bg-white/5 text-white/60 border-white/10' },
  double: { label: 'Double', cls: 'bg-white/5 text-white/50 border-white/10' },
}

export function ScorecardDemo() {
  const [holeIndex, setHoleIndex] = useState(0)
  const [displayStrokes, setDisplayStrokes] = useState<number | null>(null)
  const [phase, setPhase] = useState<'counting' | 'show' | 'next'>('counting')
  const tick = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => {
      const hole = HOLES[holeIndex]
      if (!hole) {
        setHoleIndex(0)
        setDisplayStrokes(null)
        setPhase('counting')
        return
      }

      if (phase === 'counting') {
        const current = displayStrokes ?? 0
        if (current < hole.score) {
          setDisplayStrokes(current + 1)
        } else {
          setPhase('show')
        }
      } else if (phase === 'show') {
        tick.current++
        if (tick.current >= 2) {
          tick.current = 0
          setPhase('next')
        }
      } else {
        const next = holeIndex + 1
        if (next >= HOLES.length) {
          tick.current++
          if (tick.current >= 2) {
            setHoleIndex(0)
            setDisplayStrokes(null)
            setPhase('counting')
            tick.current = 0
          }
        } else {
          setHoleIndex(next)
          setDisplayStrokes(null)
          setPhase('counting')
        }
      }
    }, 600)
    return () => clearInterval(timer)
  }, [holeIndex, displayStrokes, phase])

  const hole = HOLES[holeIndex] ?? HOLES[0]
  const isComplete = displayStrokes === hole.score && phase !== 'counting'
  const scoreType = isComplete ? getScoreType(hole.score, hole.par) : null
  const badge = scoreType ? SCORE_BADGE[scoreType] : null

  // Running total through completed holes
  const completedHoles = HOLES.slice(0, holeIndex + (isComplete ? 1 : 0))
  const runningGross = completedHoles.reduce((s, h) => s + h.score, 0)
  const runningPar = completedHoles.reduce((s, h) => s + h.par, 0)
  const runningDiff = runningGross - runningPar

  return (
    <div
      className="rounded-xl overflow-hidden shadow-lg max-w-[280px] lg:max-w-xs mx-auto md:mx-0 flex flex-col"
      style={{ backgroundColor: 'var(--primary)' }}
    >
      {/* Hole navigator strip */}
      <div className="flex bg-black/20 overflow-hidden">
        {HOLES.map((h, i) => {
          const done = i < holeIndex || (i === holeIndex && isComplete)
          const active = i === holeIndex
          return (
            <div
              key={h.hole}
              className={`flex-1 text-center py-1.5 text-[10px] font-semibold transition-colors ${
                active
                  ? 'bg-white/20 text-white'
                  : done
                    ? 'text-white/60'
                    : 'text-white/30'
              }`}
            >
              {h.hole}
            </div>
          )
        })}
      </div>

      {/* Hole info header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl lg:text-3xl font-heading font-bold text-white">
                Hole {hole.hole}
              </h2>
              {badge && (
                <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badge.cls}`}>
                  {badge.label}
                </span>
              )}
            </div>
            <p className="text-sm text-white/90 mt-0.5">
              Par {hole.par} &middot; 385 yds
            </p>
          </div>
          {completedHoles.length > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-white/60 uppercase tracking-wider">Score</p>
              <p className="text-lg font-heading font-bold text-white">
                {runningDiff === 0 ? 'E' : runningDiff > 0 ? `+${runningDiff}` : runningDiff}
              </p>
              <p className="text-[10px] text-white/50">
                Thru {completedHoles.length}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/15" />

      {/* Strokes stepper */}
      <div className="px-5 py-5 flex-1">
        <p className="text-sm font-bold text-white uppercase tracking-wider mb-3">
          Strokes
        </p>
        <div className="flex items-center justify-center gap-6">
          <div className="w-12 h-12 rounded-full bg-white/25 text-white font-bold flex items-center justify-center text-xl">
            &minus;
          </div>
          <span className="text-5xl font-heading font-bold text-white tabular-nums min-w-[60px] text-center">
            {displayStrokes ?? '-'}
          </span>
          <div className="w-12 h-12 rounded-full bg-white/25 text-white font-bold flex items-center justify-center text-xl">
            +
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="px-5 pb-4 flex items-center gap-3">
        <div className="flex items-center gap-1 px-3 py-2.5 rounded-lg bg-white/20 text-white font-semibold text-xs">
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </div>
        <div
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--primary)',
          }}
        >
          {holeIndex === HOLES.length - 1 && isComplete ? 'Finish Round' : 'Next Hole'}
          {!(holeIndex === HOLES.length - 1 && isComplete) && <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Panel dots */}
      <div className="flex items-center justify-center gap-2 pb-3 bg-black/20 py-2">
        {[0, 1, 2].map((idx) => (
          <div
            key={idx}
            className={`w-2 h-2 rounded-full ${
              idx === 1 ? 'bg-white scale-125' : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
