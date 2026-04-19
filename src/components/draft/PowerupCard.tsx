'use client'

import { SlugIcon } from './CardHand'

export interface PowerupCardData {
  id: string
  slug: string
  name: string
  type: 'BOOST' | 'ATTACK'
  description: string
  effect: {
    scoring: { mode: string; modifier: number | null }
    duration: number
    flavorText: string
    requiresTarget: boolean
  }
}

interface PowerupCardProps {
  powerup: PowerupCardData
  state?: 'available' | 'selected' | 'picked' | 'owned' | 'used'
  pickedBy?: { name: string | null; image: string | null } | null
  size?: 'sm' | 'md' | 'lg' | 'grid'
  onClick?: () => void
  disabled?: boolean
}

export function PowerupCard({
  powerup,
  state = 'available',
  pickedBy,
  size = 'md',
  onClick,
  disabled,
}: PowerupCardProps) {
  const isAttack = powerup.type === 'ATTACK'
  const isPicked = state === 'picked'
  const isUsed = state === 'used'
  const isSelected = state === 'selected'
  const iconColor = isAttack ? 'text-red-700' : 'text-emerald-800'

  const sizeClasses = {
    sm: 'w-[110px] h-[160px]',
    md: 'w-[140px] h-[200px]',
    lg: 'w-[170px] h-[245px]',
    grid: 'w-full aspect-[11/16]',
  }

  const nameFontSize = {
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-sm',
    grid: 'text-[11px] sm:text-xs',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isPicked || isUsed}
      className={`
        relative rounded-2xl overflow-hidden flex flex-col
        bg-[#f5f0e8] border-[3px] transition-all select-none
        ${sizeClasses[size]}
        ${isAttack ? 'border-red-700' : 'border-emerald-800'}
        ${isSelected ? 'ring-3 ring-amber-400 shadow-xl shadow-amber-400/20 scale-[1.03]' : ''}
        ${isPicked || isUsed ? 'opacity-50 cursor-not-allowed' : ''}
        ${!isPicked && !isUsed && !disabled ? 'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer' : ''}
        ${disabled && !isPicked && !isUsed ? 'opacity-60 cursor-not-allowed' : ''}
        shadow-md
      `}
    >
      {/* Top corner — icon + type */}
      <div className="flex items-start justify-between px-2 pt-2">
        <SlugIcon slug={powerup.slug} isAttack={isAttack} className={`${size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'} ${iconColor}`} />
        <span className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${iconColor}`}>{powerup.type}</span>
      </div>

      {/* Center — name */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 py-1">
        <div className={`w-full border-t border-b py-2 ${
          isAttack ? 'border-red-700/25' : 'border-emerald-800/25'
        }`}>
          <p className={`font-heading font-bold text-center leading-tight ${nameFontSize[size]} ${
            isAttack ? 'text-red-800' : 'text-emerald-900'
          }`}>
            {powerup.name}
          </p>
        </div>
        {/* Duration + modifier */}
        <span className={`mt-1 text-[8px] font-semibold ${
          isAttack ? 'text-red-600/60' : 'text-emerald-700/60'
        }`}>
          {powerup.effect.duration === -1 ? 'Variable' : `${powerup.effect.duration} Hole`}
          {powerup.effect.scoring.modifier !== null && (
            <> &middot; {powerup.effect.scoring.modifier > 0 ? '+' : ''}{powerup.effect.scoring.modifier}</>
          )}
        </span>
      </div>

      {/* Bottom corner — mirrored */}
      <div className="flex items-end justify-between px-2 pb-2">
        <span className={`text-[8px] font-bold uppercase tracking-widest ${iconColor}`}>{powerup.type}</span>
        <div className="rotate-180">
          <SlugIcon slug={powerup.slug} isAttack={isAttack} className={`${size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'} ${iconColor}`} />
        </div>
      </div>

      {/* Picked overlay */}
      {isPicked && pickedBy && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
          <div className="text-center">
            {pickedBy.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pickedBy.image} alt="" className="w-8 h-8 rounded-full mx-auto mb-1 border-2 border-white/40" />
            )}
            <p className="text-[11px] font-semibold text-white">
              {pickedBy.name ?? 'Player'}
            </p>
          </div>
        </div>
      )}

      {/* Used indicator */}
      {isUsed && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
          <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Used</span>
        </div>
      )}
    </button>
  )
}
