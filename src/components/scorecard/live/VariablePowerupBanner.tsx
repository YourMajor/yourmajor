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
              ? 'bg-emerald-950/80 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
              : 'bg-red-950/80 border-red-400 shadow-[0_0_12px_rgba(248,113,113,0.3)]'
          }`}
        >
          {powerupMessage.outcome === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0 text-red-400" />
          )}
          <p className={`text-sm font-semibold ${
            powerupMessage.outcome === 'success' ? 'text-emerald-200' : 'text-red-200'
          }`}>
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
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 border-emerald-500 bg-emerald-950/60 shadow-[0_0_8px_rgba(52,211,153,0.2)] animate-pulse-subtle">
        <TreePine className="w-5 h-5 shrink-0 text-emerald-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-200 truncate">
            Fairway Finder
          </p>
          <p className="text-[11px] text-emerald-300/70">
            {fairwaysHit}/{declaredCount} consecutive fairways
          </p>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: declaredCount }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < fairwaysHit ? 'bg-emerald-400' : 'bg-emerald-800'
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
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 border-amber-500 bg-amber-950/60 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse-subtle">
        <Crown className="w-5 h-5 shrink-0 text-amber-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-200 truncate">
            King of the Hill
          </p>
          <p className="text-[11px] text-amber-300/70">
            {consecutiveWins > 0
              ? `${consecutiveWins} hole${consecutiveWins !== 1 ? 's' : ''} won — streak active!`
              : 'Waiting for scores...'
            }
          </p>
        </div>
        {consecutiveWins > 0 && (
          <span className="text-sm font-bold text-amber-300">
            -{consecutiveWins}
          </span>
        )}
      </div>
    )
  }

  return null
}
