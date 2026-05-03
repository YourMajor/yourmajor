'use client'

import Image from 'next/image'
import { Crosshair, Ban, Sliders } from 'lucide-react'
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
    input?: { type: string; label?: string | null; count?: number | null } | null
    restrictions?: { excludePar3?: boolean } | null
  }
}

interface PowerupCardProps {
  powerup: PowerupCardData
  state?: 'available' | 'selected' | 'picked' | 'owned' | 'used'
  pickedBy?: { name: string | null; image: string | null } | null
  size?: 'sm' | 'md' | 'lg' | 'grid' | 'browse'
  onClick?: () => void
  disabled?: boolean
}

function formatDuration(duration: number): string {
  if (duration === -1) return '∞'
  return `${duration}H`
}

function getTeaser(description: string): string {
  const trimmed = description.trim()
  const firstSentence = trimmed.split(/(?<=[.!?])\s/)[0] ?? trimmed
  return firstSentence
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

  if (size === 'browse') {
    return <BrowseCard
      powerup={powerup}
      isAttack={isAttack}
      isPicked={isPicked}
      isUsed={isUsed}
      isSelected={isSelected}
      pickedBy={pickedBy}
      onClick={onClick}
      disabled={disabled}
    />
  }

  const iconColor = isAttack ? 'text-red-700' : 'text-emerald-800'

  const sizeClasses = {
    sm: 'w-[110px] h-[160px]',
    md: 'w-[140px] h-[200px]',
    lg: 'w-[170px] h-[245px]',
    grid: 'w-full aspect-[11/16]',
  } as const

  const nameFontSize = {
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-sm',
    grid: 'text-[11px] sm:text-xs',
  } as const

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
              <Image src={pickedBy.image} alt="" width={32} height={32} className="w-8 h-8 rounded-full mx-auto mb-1 border-2 border-white/40 object-cover" />
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

interface BrowseCardProps {
  powerup: PowerupCardData
  isAttack: boolean
  isPicked: boolean
  isUsed: boolean
  isSelected: boolean
  pickedBy?: { name: string | null; image: string | null } | null
  onClick?: () => void
  disabled?: boolean
}

function BrowseCard({ powerup, isAttack, isPicked, isUsed, isSelected, pickedBy, onClick, disabled }: BrowseCardProps) {
  const iconColor = isAttack ? 'text-red-700' : 'text-emerald-800'
  const requiresTarget = powerup.effect.requiresTarget
  const excludePar3 = powerup.effect.restrictions?.excludePar3
  const needsInput = powerup.effect.input && powerup.effect.input.type !== 'none'
  const teaser = getTeaser(powerup.description)

  const typePillClasses = isAttack
    ? 'bg-red-700/10 text-red-800 border-red-700/30'
    : 'bg-[oklch(0.72_0.11_78/0.15)] text-[oklch(0.45_0.12_78)] border-[oklch(0.72_0.11_78/0.40)]'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isPicked || isUsed}
      aria-label={`${powerup.name}, ${powerup.type.toLowerCase()}, ${powerup.effect.duration === -1 ? 'variable' : powerup.effect.duration} hole${powerup.effect.duration === 1 ? '' : 's'}`}
      className={`
        relative w-full aspect-[3/4] rounded-2xl overflow-hidden flex flex-col text-left
        bg-[#f5f0e8] border-2 transition-all select-none
        ${isAttack ? 'border-red-700/70' : 'border-emerald-800/70'}
        ${isSelected ? 'ring-2 ring-amber-400 shadow-xl shadow-amber-400/20 scale-[1.02]' : 'shadow-sm'}
        ${isPicked || isUsed ? 'opacity-55 cursor-not-allowed' : ''}
        ${!isPicked && !isUsed && !disabled ? 'hover:shadow-lg active:scale-[0.98] cursor-pointer' : ''}
        ${disabled && !isPicked && !isUsed ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      {/* Top row: type pill + duration chip */}
      <div className="flex items-start justify-between px-2.5 pt-2.5">
        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${typePillClasses}`}>
          {powerup.type}
        </span>
        <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-card/70 ${iconColor}`}>
          {formatDuration(powerup.effect.duration)}
        </span>
      </div>

      {/* Icon */}
      <div className="flex-1 flex items-center justify-center pt-1 pb-0.5">
        <SlugIcon slug={powerup.slug} isAttack={isAttack} className={`w-9 h-9 sm:w-10 sm:h-10 ${iconColor}`} />
      </div>

      {/* Name + teaser */}
      <div className="px-2.5 pb-1.5">
        <p className={`font-heading font-bold leading-tight text-[12px] line-clamp-2 ${isAttack ? 'text-red-900' : 'text-emerald-900'}`}>
          {powerup.name}
        </p>
        {teaser && (
          <p className="text-[10px] leading-tight text-zinc-600 line-clamp-2 mt-0.5">
            {teaser}
          </p>
        )}
      </div>

      {/* Micro-icon footer */}
      {(requiresTarget || excludePar3 || needsInput) && (
        <div className={`flex items-center gap-1 px-2.5 py-1 border-t ${isAttack ? 'border-red-700/15' : 'border-emerald-800/15'}`}>
          {requiresTarget && (
            <span title="Targets opponent" aria-label="Targets opponent">
              <Crosshair className={`w-3 h-3 ${iconColor}`} />
            </span>
          )}
          {excludePar3 && (
            <span title="Not on par 3" aria-label="Not on par 3">
              <Ban className={`w-3 h-3 ${iconColor}`} />
            </span>
          )}
          {needsInput && (
            <span title="Needs input" aria-label="Needs input">
              <Sliders className={`w-3 h-3 ${iconColor}`} />
            </span>
          )}
        </div>
      )}

      {/* Picked overlay */}
      {isPicked && pickedBy && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45">
          <div className="text-center">
            {pickedBy.image && (
              <Image src={pickedBy.image} alt="" width={32} height={32} className="w-8 h-8 rounded-full mx-auto mb-1 border-2 border-white/40 object-cover" />
            )}
            <p className="text-[11px] font-semibold text-white px-2">
              {pickedBy.name ?? 'Player'}
            </p>
          </div>
        </div>
      )}

      {/* Used indicator */}
      {isUsed && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45">
          <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Used</span>
        </div>
      )}
    </button>
  )
}
