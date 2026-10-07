'use client'

import { CardHand, SlugIcon, powerupStyles } from '@/components/draft/CardHand'
import type { PowerupEffect } from '@/lib/powerup-engine'

export interface PlayerPowerupData {
  playerPowerupId: string
  powerupId: string
  slug: string
  name: string
  type: 'BOOST' | 'ATTACK'
  description: string
  effect: PowerupEffect
  // ARMED = a reactive card played and lying in wait. Still in hand
  // conceptually, but not playable again.
  status: 'AVAILABLE' | 'ACTIVE' | 'USED' | 'ARMED'
}

export interface ActivePowerupInfo {
  playerPowerupId: string
  powerupName: string
  powerupSlug: string
  powerupType: 'BOOST' | 'ATTACK'
  scoreModifier: number | null
  description: string
}

interface PlayerOption {
  id: string
  name: string
}

interface PowerupTrayProps {
  playerPowerups: PlayerPowerupData[]
  activePowerups: ActivePowerupInfo[]
  attacksReceived: ActivePowerupInfo[]
  onActivate: (data: {
    playerPowerupId: string
    targetPlayerId?: string
    targetHoleNumber?: number
    metadata?: Record<string, unknown>
  }) => Promise<void>
  tournamentPlayers: PlayerOption[]
  currentPlayerId: string
  courseHoleNumbers: number[]
  opponentScoredHoles: Record<string, number[]>
}

export function PowerupTray({
  playerPowerups,
  activePowerups,
  attacksReceived,
  onActivate,
  tournamentPlayers,
  currentPlayerId,
  courseHoleNumbers,
  opponentScoredHoles,
}: PowerupTrayProps) {
  const availablePowerups = playerPowerups.filter((p) => p.status === 'AVAILABLE')
  // Armed reactive cards. Shown separately and not playable: they have been
  // committed, but they have not done anything yet, so hiding them (which is
  // what filtering the hand to AVAILABLE alone used to do) would leave the
  // player with no idea they were protected.
  const armedPowerups = playerPowerups.filter((p) => p.status === 'ARMED')

  // Build playerPowerupId map for inline activation
  const playerPowerupIdMap: Record<string, string> = {}
  for (const p of availablePowerups) {
    playerPowerupIdMap[p.powerupId] = p.playerPowerupId
  }

  return (
    <div className="space-y-2.5">
      {/* Available powerups — card hand with inline activation */}
      {availablePowerups.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">
            Powerups ({availablePowerups.length})
          </p>
          <CardHand
            cards={availablePowerups.map((p) => ({
              powerupId: p.powerupId,
              powerup: {
                id: p.powerupId,
                slug: p.slug,
                name: p.name,
                type: p.type,
                description: p.description,
                effect: p.effect,
              },
            }))}
            activationContext={{
              players: tournamentPlayers,
              currentPlayerId,
              onActivate,
              playerPowerupIdMap,
              courseHoleNumbers,
              opponentScoredHoles,
            }}
          />
        </div>
      )}

      {/* Armed and waiting. Deliberately a flat list rather than a playable
          hand — tapping one must not re-activate it. */}
      {armedPowerups.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">
            Armed ({armedPowerups.length})
          </p>
          <ul className="space-y-1">
            {armedPowerups.map((p) => (
              <li
                key={p.playerPowerupId}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-powerup-active/60 ${
                  powerupStyles(p.type === 'ATTACK').soft
                }`}
              >
                <SlugIcon
                  slug={p.slug}
                  isAttack={p.type === 'ATTACK'}
                  className={`w-5 h-5 shrink-0 ${powerupStyles(p.type === 'ATTACK').ink}`}
                />
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${powerupStyles(p.type === 'ATTACK').name}`}>
                    {p.name}
                  </p>
                  <p className={`text-[11px] ${powerupStyles(p.type === 'ATTACK').caption}`}>
                    Waiting — fires on its own
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {availablePowerups.length === 0 && armedPowerups.length === 0 && activePowerups.length === 0 && attacksReceived.length === 0 && (
        <p className="text-xs text-white/30 py-1">No powerups available</p>
      )}
    </div>
  )
}
