'use client'

import { CardHand } from '@/components/draft/CardHand'
import type { PowerupEffect } from '@/lib/powerup-engine'

export interface PlayerPowerupData {
  playerPowerupId: string
  powerupId: string
  slug: string
  name: string
  type: 'BOOST' | 'ATTACK'
  description: string
  effect: PowerupEffect
  status: 'AVAILABLE' | 'ACTIVE' | 'USED'
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
    metadata?: Record<string, unknown>
  }) => Promise<void>
  tournamentPlayers: PlayerOption[]
  currentPlayerId: string
}

export function PowerupTray({
  playerPowerups,
  activePowerups,
  attacksReceived,
  onActivate,
  tournamentPlayers,
  currentPlayerId,
}: PowerupTrayProps) {
  const availablePowerups = playerPowerups.filter((p) => p.status === 'AVAILABLE')

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
            }}
          />
        </div>
      )}

      {availablePowerups.length === 0 && activePowerups.length === 0 && attacksReceived.length === 0 && (
        <p className="text-xs text-white/30 py-1">No powerups available</p>
      )}
    </div>
  )
}
