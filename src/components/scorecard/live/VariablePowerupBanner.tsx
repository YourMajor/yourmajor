'use client'

import { TreePine, Crown, CheckCircle2, XCircle } from 'lucide-react'

export interface VariablePowerupState {
  playerPowerupId: string
  slug: string
  name: string
  metadata: Record<string, unknown>
  status: 'ACTIVE' | 'USED'
}

export interface PowerupMessage {
  playerPowerupId: string
  slug: string
  outcome: 'success' | 'failed'
  message: string
}

interface VariablePowerupBannerProps {
  activeVariablePowerups: VariablePowerupState[]
  powerupMessage: PowerupMessage | null
}

export function VariablePowerupBanner({
  activeVariablePowerups,
  powerupMessage,
}: VariablePowerupBannerProps) {
  if (activeVariablePowerups.length === 0 && !powerupMessage) return null

  return (
    <div className="px-5 pt-3 space-y-1.5">
      {/* Active variable powerup progress banners */}
      {activeVariablePowerups.map((vp) => (
        <VariablePowerupCard key={vp.playerPowerupId} powerup={vp} />
      ))}

      {/* Toast message for success/failure */}
      {powerupMessage && (
        <div
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
            powerupMessage.outcome === 'success'
              ? 'bg-zinc-950/85 border-success shadow-[0_0_12px] shadow-success/30'
              : 'bg-zinc-950/85 border-destructive shadow-[0_0_12px] shadow-destructive/30'
          }`}
        >
          {powerupMessage.outcome === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-success" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0 text-destructive" />
          )}
          <p className="text-sm font-semibold text-powerup-stock">
            {powerupMessage.message}
          </p>
        </div>
      )}
    </div>
  )
}

function VariablePowerupCard({ powerup }: { powerup: VariablePowerupState }) {
  const meta = powerup.metadata

  if (powerup.slug === 'fairway-finder') {
    const fairwaysHit = (meta.fairwaysHit as number) ?? 0
    const declaredCount = (meta.declaredCount as number) ?? 0

    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 border-powerup-active bg-zinc-950/85 shadow-[0_0_8px] shadow-powerup-active/20 animate-pulse-subtle">
        <TreePine className="w-5 h-5 shrink-0 text-powerup-active" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-powerup-stock truncate">
            Fairway Finder
          </p>
          <p className="text-[11px] text-powerup-stock/70">
            {fairwaysHit}/{declaredCount} consecutive fairways
          </p>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: declaredCount }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < fairwaysHit ? 'bg-powerup-active' : 'bg-powerup-active/25'
              }`}
            />
          ))}
        </div>
      </div>
    )
  }

  if (powerup.slug === 'king-of-the-hill') {
    const consecutiveWins = (meta.consecutiveWins as number) ?? 0

    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 border-powerup-active bg-zinc-950/85 shadow-[0_0_8px] shadow-powerup-active/20 animate-pulse-subtle">
        <Crown className="w-5 h-5 shrink-0 text-powerup-active" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-powerup-stock truncate">
            King of the Hill
          </p>
          <p className="text-[11px] text-powerup-stock/70">
            {consecutiveWins > 0
              ? `${consecutiveWins} hole${consecutiveWins !== 1 ? 's' : ''} won — streak active!`
              : 'Waiting for scores...'
            }
          </p>
        </div>
        {consecutiveWins > 0 && (
          <span className="text-sm font-bold text-accent">
            -{consecutiveWins}
          </span>
        )}
      </div>
    )
  }

  return null
}
