'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Zap } from 'lucide-react'

interface Player {
  id: string
  user: { name: string | null; image: string | null }
}

interface DealAnimationProps {
  players: Player[]
  totalCards: number
  onComplete: () => void
}

/** Animated card dealing overlay — shuffles a deck then deals cards to each player in turn */
export function DealAnimation({ players, totalCards, onComplete }: DealAnimationProps) {
  const [phase, setPhase] = useState<'shuffle' | 'deal' | 'done'>('shuffle')
  const [dealIndex, setDealIndex] = useState(0)
  const [shuffleCount, setShuffleCount] = useState(0)

  // Shuffle animation: quick card flip effect
  useEffect(() => {
    if (phase !== 'shuffle') return
    const timer = setInterval(() => {
      setShuffleCount((c) => {
        if (c >= 8) {
          setPhase('deal')
          return c
        }
        return c + 1
      })
    }, 200)
    return () => clearInterval(timer)
  }, [phase])

  // Deal animation: deal cards one at a time
  useEffect(() => {
    if (phase !== 'deal') return
    const timer = setInterval(() => {
      setDealIndex((i) => {
        if (i >= totalCards - 1) {
          setPhase('done')
          return i
        }
        return i + 1
      })
    }, 300)
    return () => clearInterval(timer)
  }, [phase, totalCards])

  // Auto-complete after showing done state
  useEffect(() => {
    if (phase !== 'done') return
    const timer = setTimeout(onComplete, 1500)
    return () => clearTimeout(timer)
  }, [phase, onComplete])

  const currentPlayer = phase === 'deal' ? players[dealIndex % players.length] : null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80">
      <div className="text-center space-y-6">
        {/* Shuffle phase */}
        {phase === 'shuffle' && (
          <>
            <div className="relative w-32 h-44 mx-auto">
              {/* Stack of cards with shuffle animation */}
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-xl border-2 border-white/20 bg-gradient-to-br from-emerald-900 to-emerald-950"
                  style={{
                    transform: `rotate(${(shuffleCount % 2 === 0 ? 1 : -1) * (i * 3 + shuffleCount * 5)}deg) translateX(${(shuffleCount % 2 === 0 ? 1 : -1) * i * 4}px)`,
                    transition: 'transform 0.15s ease-out',
                    zIndex: 5 - i,
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl">🃏</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xl font-heading font-bold text-white animate-pulse">
              Shuffling...
            </p>
          </>
        )}

        {/* Deal phase */}
        {phase === 'deal' && currentPlayer && (
          <>
            <div className="relative w-24 h-32 mx-auto">
              <div
                className="absolute inset-0 rounded-xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-900 to-emerald-950 shadow-lg shadow-emerald-500/20 animate-bounce"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <Zap className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Player receiving */}
            <div className="flex items-center justify-center gap-3">
              {currentPlayer.user.image ? (
                <Image src={currentPlayer.user.image} alt="" width={40} height={40} className="w-10 h-10 rounded-full border-2 border-white/30 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {(currentPlayer.user.name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <p className="text-lg font-heading font-bold text-white">
                {currentPlayer.user.name ?? 'Player'}
              </p>
            </div>

            <p className="text-sm text-white/60">
              Card {dealIndex + 1} of {totalCards}
            </p>

            {/* Progress bar */}
            <div className="w-64 mx-auto h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${((dealIndex + 1) / totalCards) * 100}%` }}
              />
            </div>
          </>
        )}

        {/* Done phase */}
        {phase === 'done' && (
          <>
            <div className="text-5xl">🎴</div>
            <p className="text-2xl font-heading font-bold text-white">
              Cards Dealt!
            </p>
            <p className="text-sm text-white/60">
              {players.length} player{players.length !== 1 ? 's' : ''} received their powerups
            </p>
          </>
        )}
      </div>
    </div>
  )
}
