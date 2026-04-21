'use client'

import { useState, useCallback, useMemo, type ElementType } from 'react'
import {
  Zap, Swords, Beer, Footprints, Flag, HandMetal, Dice5, Pickaxe, Shield,
  Crown, Handshake, Ruler, Bomb, Target, Shuffle, Hand, Waves,
  TreePine, RefreshCw, Smile, MapPin, CircleDot, GlassWater, ArrowLeftRight,
  Flame, Crosshair, Route, Trophy, Umbrella, Repeat, CircleDot as Putt, Skull,
} from 'lucide-react'
import type { PowerupCardData } from './PowerupCard'
import { FlippableCardOverlay } from './FlippableCardOverlay'
import { GOLF_CLUBS, type PowerupEffect } from '@/lib/powerup-engine'

const SLUG_ICON_COMPONENTS: Record<string, ElementType> = {
  'shots-for-shots': Beer, 'walk-it-in': Footprints, 'left-on-red': Flag, 'concede': HandMetal,
  'can-i-get-your-number': Dice5, 'the-sandman': Pickaxe, 'iron-man': Shield, 'king-of-the-hill': Crown,
  'best-buddies': Handshake, 'the-long-drive': Ruler, 'bunker-buster': Bomb, '1-vs-all': Target,
  'drive-for-show-putt-for-dough': Shuffle, 'the-fluffer': Hand, 'skipping-stones': Waves,
  'fairway-finder': TreePine, 'playing-with-yourself': RefreshCw, 'happy-gilmore': Smile,
  'just-the-tip': MapPin, 'club-roulette': CircleDot, 'drink-up': GlassWater, 'parent-trap': ArrowLeftRight,
  'the-fairway-is-lava': Flame, 'proximity-mine': Crosshair, 'the-long-and-winding-road': Route,
  'go-for-glory': Trophy, 'beach-boys': Umbrella, 'freaky-friday': Repeat, 'the-texas-wedge': Putt,
  'worst-ball': Skull,
}

/** Render the icon for a powerup slug. Falls back to Zap (boost) or Swords (attack). */
function SlugIcon({ slug, isAttack, className }: { slug: string; isAttack: boolean; className?: string }) {
  const Icon = SLUG_ICON_COMPONENTS[slug] ?? (isAttack ? Swords : Zap)
  return <Icon className={className} />
}

export { SLUG_ICON_COMPONENTS, SlugIcon }

interface ActivationContext {
  players: Array<{ id: string; name: string }>
  currentPlayerId: string
  onActivate: (data: {
    playerPowerupId: string
    targetPlayerId?: string
    metadata?: Record<string, unknown>
  }) => Promise<void>
  /** Map from powerupId to playerPowerupId */
  playerPowerupIdMap: Record<string, string>
}

interface CardHandProps {
  cards: Array<{
    powerupId: string
    powerup: PowerupCardData
  }>
  onCardClick?: (powerupId: string) => void
  /** @deprecated Use activationContext instead for inline activation */
  onActivateCard?: (powerupId: string) => void
  /** When provided, embeds target/input selection directly on the card back */
  activationContext?: ActivationContext
  /** When set, the matching card gets a brief golden glow highlight */
  highlightCardId?: string | null
}

export function CardHand({ cards, onCardClick, onActivateCard, activationContext, highlightCardId }: CardHandProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [flippedId, setFlippedId] = useState<string | null>(null)
  const count = cards.length

  const maxSpread = count <= 2 ? count * 10 : Math.min(count * 7, 35)
  const startAngle = -maxSpread / 2
  const cardW = Math.max(140, Math.min(200, 600 / Math.max(count, 2)))
  const cardH = cardW * 1.45
  const overlap = Math.max(30, cardW * 0.35)

  const openCard = useCallback((powerupId: string) => {
    setHoveredId(null)
    setFlippedId(powerupId)
    onCardClick?.(powerupId)
  }, [onCardClick])

  const closeCard = useCallback(() => {
    setHoveredId(null)
    setFlippedId(null)
  }, [])

  const flippedCard = flippedId ? cards.find((c) => c.powerupId === flippedId) : null
  const flippedPowerup = flippedCard?.powerup ?? null

  const backContent = useMemo(() => {
    if (!flippedCard) return null
    const card = flippedCard
    const isAttack = card.powerup.type === 'ATTACK'
    const effect = card.powerup.effect as PowerupEffect

    return (
      <CardBack
        slug={card.powerup.slug}
        name={card.powerup.name}
        type={card.powerup.type}
        description={card.powerup.description}
        effect={effect}
        isAttack={isAttack}
        onClose={closeCard}
        activationContext={activationContext ? {
          ...activationContext,
          powerupId: card.powerupId,
          playerPowerupId: activationContext.playerPowerupIdMap[card.powerupId],
        } : undefined}
        onActivate={!activationContext && onActivateCard ? () => {
          closeCard()
          setTimeout(() => onActivateCard(card.powerupId), 650)
        } : undefined}
      />
    )
  }, [flippedCard, activationContext, onActivateCard, closeCard])

  return (
    <>
      {/* ── Hand container ── */}
      <div
        className="relative flex items-end justify-center mx-auto w-full"
        style={{ height: `${cardH + 80}px`, maxWidth: '100%' }}
      >
        {cards.map((card, i) => {
          const isAttack = card.powerup.type === 'ATTACK'
          const isHovered = hoveredId === card.powerupId
          const isFlipped = flippedId === card.powerupId
          const isHighlighted = highlightCardId === card.powerupId
          const angle = count === 1 ? 0 : startAngle + (i / (count - 1)) * maxSpread
          const yOffset = Math.abs(angle) * 1.2
          const slug = card.powerup.slug
          const effect = card.powerup.effect as PowerupEffect
          const rotation = isHovered ? 0 : angle

          if (isFlipped) return <div key={card.powerupId} />

          return (
            <div
              key={card.powerupId}
              className={`absolute ${isHighlighted ? 'animate-pulse' : ''}`}
              style={{
                width: `${cardW}px`,
                height: `${cardH}px`,
                left: `calc(50% + ${(i - (count - 1) / 2) * overlap}px - ${cardW / 2}px)`,
                bottom: isHovered ? `${50 + yOffset}px` : `${yOffset}px`,
                zIndex: isHovered ? 50 : i + 1,
                transformOrigin: 'bottom center',
                transition: 'left 0.5s ease-out, bottom 0.5s ease-out, transform 0.5s ease-out',
                transform: `rotate(${rotation}deg)`,
                ...(isHighlighted ? {
                  filter: 'drop-shadow(0 0 12px rgba(251, 191, 36, 0.7))',
                } : {}),
              }}
            >
              <button
                type="button"
                className={`relative w-full h-full cursor-pointer ${
                  isHighlighted ? 'ring-2 ring-amber-400 rounded-2xl' : ''
                }`}
                onClick={() => openCard(card.powerupId)}
                onMouseEnter={() => setHoveredId(card.powerupId)}
                onMouseLeave={() => setHoveredId(null)}
                aria-label={`View ${card.powerup.name}`}
              >
                <CardFront
                  slug={slug}
                  name={card.powerup.name}
                  type={card.powerup.type}
                  effect={effect}
                  isAttack={isAttack}
                  isHovered={isHovered}
                  count={count}
                />
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Flipped card overlay ── */}
      <FlippableCardOverlay
        powerup={flippedPowerup}
        onClose={closeCard}
        backContent={backContent}
      />
    </>
  )
}

// ─── Card Face Sub-components ─────────────────────────────────────────────────

export function CardFront({
  slug, name, type, effect, isAttack, isHovered, count, large,
}: {
  slug: string; name: string; type: string; effect: PowerupEffect
  isAttack: boolean; isHovered: boolean; count: number; large?: boolean
}) {
  const fontSize = large ? 20 : Math.max(12, 16 - count)
  const iconSize = large ? 'w-8 h-8' : 'w-6 h-6'
  const iconColor = isAttack ? 'text-red-700' : 'text-emerald-800'
  return (
    <div className={`
      absolute inset-0 rounded-2xl flex flex-col select-none bg-[#f5f0e8] border-[3px]
      ${isAttack ? 'border-red-700' : 'border-emerald-800'}
      ${isHovered ? 'shadow-2xl shadow-black/40' : 'shadow-lg shadow-black/15'}
    `}>
      <div className="flex items-start justify-between px-3 pt-3">
        <SlugIcon slug={slug} isAttack={isAttack} className={`${iconSize} ${iconColor}`} />
        <span className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${iconColor}`}>{type}</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-3 py-2">
        <div className={`w-full border-t border-b py-3 ${
          isAttack ? 'border-red-700/30' : 'border-emerald-800/30'
        }`}>
          <p className={`font-heading font-bold text-center leading-tight ${
            isAttack ? 'text-red-800' : 'text-emerald-900'
          }`} style={{ fontSize: `${fontSize}px` }}>
            {name}
          </p>
        </div>
        <span className={`mt-2 text-[11px] font-semibold ${
          isAttack ? 'text-red-600/70' : 'text-emerald-700/70'
        }`}>
          {effect.duration === -1 ? 'Variable' : `${effect.duration} Hole`}
          {effect.scoring.modifier !== null && (
            <> &middot; {effect.scoring.modifier > 0 ? '+' : ''}{effect.scoring.modifier}</>
          )}
        </span>
      </div>
      <div className="flex items-end justify-between px-3 pb-3">
        <span className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${iconColor}`}>{type}</span>
        <div className="rotate-180">
          <SlugIcon slug={slug} isAttack={isAttack} className={`${iconSize} ${iconColor}`} />
        </div>
      </div>
    </div>
  )
}

export function CardBack({
  slug, name, type, description, effect, isAttack, onClose, onActivate, activationContext, customFooter,
}: {
  slug: string; name: string; type: string; description: string
  effect: PowerupEffect; isAttack: boolean
  onClose: () => void
  onActivate?: () => void
  activationContext?: {
    players: Array<{ id: string; name: string }>
    currentPlayerId: string
    onActivate: (data: { playerPowerupId: string; targetPlayerId?: string; metadata?: Record<string, unknown> }) => Promise<void>
    powerupId: string
    playerPowerupId: string
  }
  /** When provided, replaces the default footer */
  customFooter?: React.ReactNode
}) {
  const [targetPlayerId, setTargetPlayerId] = useState('')
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [playerSearch, setPlayerSearch] = useState('')
  const [clubName, setClubName] = useState('')
  const [numberValue, setNumberValue] = useState('')
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canActivateCtx = !!activationContext
  const needsTarget = effect.requiresTarget
  const inputType = effect.input?.type ?? 'none'
  const inputCount = effect.input?.count ?? null
  const isMultiPlayerSelect = inputType === 'player_select' && inputCount !== null && !needsTarget
  const otherPlayers = activationContext?.players.filter((p) => p.id !== activationContext.currentPlayerId) ?? []

  const canSubmit = (() => {
    if (!canActivateCtx) return false
    if (needsTarget && !targetPlayerId) return false
    if (isMultiPlayerSelect && selectedPlayerIds.length === 0) return false
    if (inputType === 'club_select' && !clubName) return false
    if (inputType === 'number_input' && !needsTarget && !numberValue) return false
    return true
  })()

  const togglePlayerSelection = (playerId: string) => {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId)
      if (inputCount !== null && prev.length >= inputCount) return prev
      return [...prev, playerId]
    })
  }

  const handleActivateInline = async () => {
    if (!activationContext) return
    setActivating(true)
    setError(null)
    try {
      const metadata: Record<string, unknown> = {}
      if (clubName) metadata.clubName = clubName
      if (numberValue) metadata.numberValue = parseInt(numberValue, 10)
      if (isMultiPlayerSelect && selectedPlayerIds.length > 0) metadata.selectedPlayerIds = selectedPlayerIds
      await activationContext.onActivate({
        playerPowerupId: activationContext.playerPowerupId,
        targetPlayerId: targetPlayerId || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to activate')
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`px-5 pt-4 pb-2.5 shrink-0 ${isAttack ? 'bg-red-800' : 'bg-emerald-900'}`}>
        <div className="flex items-center gap-3">
          <SlugIcon slug={slug} isAttack={isAttack} className="w-7 h-7 text-white" />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">{type}</p>
            <p className="text-lg font-heading font-bold text-white leading-tight">{name}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-3 overflow-y-auto space-y-2.5">
        <p className="text-[13px] text-zinc-800 leading-relaxed">{description}</p>

        <div className="flex flex-wrap gap-1.5">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            isAttack ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {effect.duration === -1 ? 'Variable' : `${effect.duration} Hole`}
          </span>
          {effect.scoring.modifier !== null && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              effect.scoring.modifier < 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}>
              {effect.scoring.modifier > 0 ? '+' : ''}{effect.scoring.modifier} strokes
            </span>
          )}
        </div>

        {effect.flavorText && (
          <p className="text-[11px] italic text-zinc-500">
            &ldquo;{effect.flavorText}&rdquo;
          </p>
        )}

        {/* Inline activation inputs */}
        {canActivateCtx && (
          <div className="space-y-2 pt-1 border-t border-zinc-200">
            {needsTarget && (
              <div>
                <label className="text-[11px] font-semibold text-zinc-600 mb-1 block">
                  {effect.input?.label ?? 'Select opponent to attack'}
                </label>
                <select
                  value={targetPlayerId}
                  onChange={(e) => setTargetPlayerId(e.target.value)}
                  className="w-full h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800"
                >
                  <option value="">Choose opponent...</option>
                  {otherPlayers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            {inputType === 'club_select' && (
              <div>
                <label className="text-[11px] font-semibold text-zinc-600 mb-1 block">
                  {effect.input?.label ?? 'Select club'}
                </label>
                <select
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="w-full h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800"
                >
                  <option value="">Choose a club...</option>
                  {GOLF_CLUBS.map((club) => (
                    <option key={club} value={club}>{club}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Multi-player select (for King of the Hill etc.) */}
            {isMultiPlayerSelect && (
              <div>
                <label className="text-[11px] font-semibold text-zinc-600 mb-1 block">
                  {effect.input?.label ?? 'Select players'} ({selectedPlayerIds.length}/{inputCount})
                </label>
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Search players..."
                  className="w-full h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800 mb-1.5"
                />
                {selectedPlayerIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {selectedPlayerIds.map((id) => {
                      const p = otherPlayers.find((pl) => pl.id === id)
                      return (
                        <span key={id} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 pl-2 pr-1 py-0.5 rounded-full">
                          {p?.name ?? 'Player'}
                          <button type="button" onClick={() => togglePlayerSelection(id)} className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-emerald-200">&times;</button>
                        </span>
                      )
                    })}
                  </div>
                )}
                <div className="max-h-28 overflow-y-auto space-y-0.5 border border-zinc-200 rounded-md">
                  {otherPlayers
                    .filter((p) => !playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase()))
                    .map((p) => {
                      const isSelected = selectedPlayerIds.includes(p.id)
                      const atMax = inputCount !== null && selectedPlayerIds.length >= inputCount && !isSelected
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={atMax}
                          onClick={() => togglePlayerSelection(p.id)}
                          className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                            isSelected
                              ? 'bg-emerald-100 text-emerald-900 font-semibold'
                              : atMax
                                ? 'text-zinc-400 cursor-not-allowed'
                                : 'text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          {isSelected && <span className="mr-1">&#10003;</span>}
                          {p.name}
                        </button>
                      )
                    })}
                </div>
              </div>
            )}
            {/* Number input (for Fairway Finder etc.) */}
            {inputType === 'number_input' && !needsTarget && (
              <div>
                <label className="text-[11px] font-semibold text-zinc-600 mb-1 block">
                  {effect.input?.label ?? 'Enter a number'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={18}
                  value={numberValue}
                  onChange={(e) => setNumberValue(e.target.value)}
                  className="w-20 h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800"
                />
              </div>
            )}
            {error && (
              <p className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`px-5 py-2.5 shrink-0 flex gap-2 ${isAttack ? 'bg-red-800/10' : 'bg-emerald-900/10'}`}>
        {customFooter ? customFooter : canActivateCtx ? (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={activating}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-200 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleActivateInline}
              disabled={!canSubmit || activating}
              className={`flex-1 py-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50 ${
                isAttack ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {activating ? 'Activating...' : isAttack ? 'Attack!' : 'Play Card'}
            </button>
          </>
        ) : onActivate ? (
          <>
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-200 transition-colors">Back</button>
            <button type="button" onClick={onActivate} className={`flex-1 py-2 rounded-lg text-xs font-bold text-white transition-colors ${isAttack ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}>
              {isAttack ? 'Play Attack' : 'Play Card'}
            </button>
          </>
        ) : (
          <button type="button" onClick={onClose} className="w-full py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-zinc-200 transition-colors">
            Tap to flip back
          </button>
        )}
      </div>
    </div>
  )
}
