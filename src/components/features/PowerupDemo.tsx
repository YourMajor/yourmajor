'use client'

import { useState, useEffect, useRef } from 'react'
import { Zap, Crosshair, Shield } from 'lucide-react'

const CARDS = [
  {
    name: 'Mulligan',
    type: 'BOOST' as const,
    slug: 'mulligan',
    desc: 'Re-take your last shot',
    duration: '1 Hole',
    modifier: -1,
    flavorText: 'Everyone deserves a second chance.',
  },
  {
    name: 'Sand Trap',
    type: 'ATTACK' as const,
    slug: 'sand-trap',
    desc: 'Bury an opponent in the bunker',
    duration: '1 Hole',
    modifier: +2,
    flavorText: 'Hope you packed a sand wedge.',
  },
  {
    name: 'Tailwind',
    type: 'BOOST' as const,
    slug: 'tailwind',
    desc: 'Extra distance off the tee',
    duration: '1 Hole',
    modifier: -1,
    flavorText: 'The wind is at your back today.',
  },
]

type Phase = 'hand' | 'activate' | 'result'

function SlugIcon({ slug, isAttack, className }: { slug: string; isAttack: boolean; className: string }) {
  if (isAttack) return <Crosshair className={className} />
  if (slug === 'tailwind') return <Shield className={className} />
  return <Zap className={className} />
}

export function PowerupDemo() {
  const [cardIndex, setCardIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('hand')
  const step = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => {
      step.current++
      const s = step.current % 5
      if (s === 0) {
        setCardIndex((i) => (i + 1) % CARDS.length)
        setPhase('hand')
      } else if (s === 2) {
        setPhase('activate')
      } else if (s === 3) {
        setPhase('result')
      }
    }, 1200)
    return () => clearInterval(timer)
  }, [])

  const card = CARDS[cardIndex]
  const isAttack = card.type === 'ATTACK'
  const iconColor = isAttack ? 'text-red-700' : 'text-emerald-800'
  const nameColor = isAttack ? 'text-red-800' : 'text-emerald-900'
  const borderColor = isAttack ? 'border-red-700' : 'border-emerald-800'
  const dividerColor = isAttack ? 'border-red-700/25' : 'border-emerald-800/25'
  const metaColor = isAttack ? 'text-red-600/60' : 'text-emerald-700/60'

  return (
    <div className="max-w-[220px] lg:max-w-[280px] mx-auto md:mx-0 space-y-3">
      {/* Powerup card — card-game style */}
      <div
        className={`relative rounded-2xl overflow-hidden flex flex-col bg-[#f5f0e8] border-[3px] shadow-md transition-all duration-500 ${borderColor} ${
          phase === 'activate'
            ? 'ring-3 ring-amber-400 shadow-xl shadow-amber-400/20 scale-[1.03]'
            : phase === 'result'
              ? isAttack ? 'ring-3 ring-red-400 shadow-lg' : 'ring-3 ring-emerald-400 shadow-lg'
              : ''
        }`}
      >
        {/* Top corner — icon + type */}
        <div className="flex items-start justify-between px-3 pt-3">
          <SlugIcon slug={card.slug} isAttack={isAttack} className={`w-6 h-6 lg:w-7 lg:h-7 ${iconColor}`} />
          <span className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${iconColor}`}>
            {card.type}
          </span>
        </div>

        {/* Center — name */}
        <div className="flex-1 flex flex-col items-center justify-center px-3 py-2">
          <div className={`w-full border-t border-b py-3 ${dividerColor}`}>
            <p className={`font-heading font-bold text-center text-lg lg:text-xl leading-tight ${nameColor}`}>
              {card.name}
            </p>
          </div>
          <span className={`mt-1.5 text-[9px] font-semibold ${metaColor}`}>
            {card.duration}
            {' '}&middot;{' '}
            {card.modifier > 0 ? '+' : ''}{card.modifier} stroke{Math.abs(card.modifier) !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Bottom corner — mirrored */}
        <div className="flex items-end justify-between px-3 pb-3">
          <span className={`text-[8px] font-bold uppercase tracking-widest ${iconColor}`}>
            {card.type}
          </span>
          <div className="rotate-180">
            <SlugIcon slug={card.slug} isAttack={isAttack} className={`w-6 h-6 lg:w-7 lg:h-7 ${iconColor}`} />
          </div>
        </div>

        {/* Activation overlay */}
        {phase === 'activate' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30">
            <div className="text-center">
              <p className="text-sm font-bold text-white animate-pulse">
                {isAttack ? 'Targeting...' : 'Activating...'}
              </p>
            </div>
          </div>
        )}

        {/* Result overlay */}
        {phase === 'result' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
            <div className={`rounded-lg px-4 py-2 text-center ${
              isAttack ? 'bg-red-50' : 'bg-emerald-50'
            }`}>
              <p className={`text-sm font-bold ${isAttack ? 'text-red-800' : 'text-emerald-900'}`}>
                {card.modifier > 0 ? '+' : ''}{card.modifier} stroke{Math.abs(card.modifier) !== 1 ? 's' : ''}
              </p>
              <p className={`text-[10px] mt-0.5 ${isAttack ? 'text-red-600/70' : 'text-emerald-700/70'}`}>
                {isAttack ? 'on M. Johnson' : 'on Hole 7'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Description below card */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground italic">
          &ldquo;{card.flavorText}&rdquo;
        </p>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5">
        {CARDS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === cardIndex ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
