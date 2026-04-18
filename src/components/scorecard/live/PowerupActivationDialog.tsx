'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Loader2, Zap, Swords } from 'lucide-react'
import { GOLF_CLUBS, type PowerupEffect } from '@/lib/powerup-engine'

interface PlayerOption {
  id: string
  name: string
}

interface PowerupData {
  playerPowerupId: string
  powerupId: string
  slug: string
  name: string
  type: 'BOOST' | 'ATTACK'
  description: string
  effect: PowerupEffect
}

interface PowerupActivationDialogProps {
  powerup: PowerupData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onActivate: (data: {
    playerPowerupId: string
    targetPlayerId?: string
    metadata?: Record<string, unknown>
  }) => Promise<void>
  players: PlayerOption[]
  currentPlayerId: string
}

export function PowerupActivationDialog({
  powerup,
  open,
  onOpenChange,
  onActivate,
  players,
  currentPlayerId,
}: PowerupActivationDialogProps) {
  const [targetPlayerId, setTargetPlayerId] = useState<string>('')
  const [clubName, setClubName] = useState<string>('')
  const [numberValue, setNumberValue] = useState<string>('')
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!powerup) return null

  const effect = powerup.effect
  const isAttack = powerup.type === 'ATTACK'
  const otherPlayers = players.filter((p) => p.id !== currentPlayerId)

  const needsTarget = effect.requiresTarget
  const inputType = effect.input?.type ?? 'none'

  const canSubmit = (() => {
    if (needsTarget && !targetPlayerId) return false
    if (inputType === 'club_select' && !clubName) return false
    if (inputType === 'number_input' && !numberValue) return false
    return true
  })()

  const handleActivate = async () => {
    setActivating(true)
    setError(null)
    try {
      const metadata: Record<string, unknown> = {}
      if (clubName) metadata.clubName = clubName
      if (numberValue) metadata.numberValue = parseInt(numberValue, 10)

      await onActivate({
        playerPowerupId: powerup.playerPowerupId,
        targetPlayerId: targetPlayerId || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      })
      onOpenChange(false)
      setTargetPlayerId('')
      setClubName('')
      setNumberValue('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to activate')
    } finally {
      setActivating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!activating) onOpenChange(v) }}>
      <DialogContent
        className={`max-w-sm border-2 ${
          isAttack
            ? 'bg-zinc-950 border-red-600/60'
            : 'bg-zinc-950 border-emerald-600/60'
        }`}
      >
        {/* Header with icon + type */}
        <div className="flex items-start gap-3 pt-1">
          <div className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${
            isAttack
              ? 'bg-red-600/20 border-2 border-red-500/50'
              : 'bg-emerald-600/20 border-2 border-emerald-500/50'
          }`}>
            {isAttack
              ? <Swords className="w-5 h-5 text-red-400" />
              : <Zap className="w-5 h-5 text-emerald-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${
              isAttack ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {powerup.type}
            </p>
            {/* WCAG AA: white (#fff) on zinc-950 (#09090b) = 19.6:1 contrast */}
            <h2 className="text-lg font-heading font-bold text-white leading-snug mt-0.5">
              {powerup.name}
            </h2>
          </div>
        </div>

        {/* Description — WCAG AA: zinc-300 (#d4d4d8) on zinc-950 = 12.5:1 */}
        <p className="text-sm text-zinc-300 leading-relaxed">
          {powerup.description}
        </p>

        {/* Info row */}
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
            isAttack
              ? 'bg-red-600/20 text-red-300 border border-red-500/30'
              : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
          }`}>
            {effect.duration === -1 ? 'Variable duration' : `${effect.duration} Hole`}
          </span>
          {effect.scoring.modifier !== null && (
            <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${
              effect.scoring.modifier < 0
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                : 'bg-red-600/20 text-red-300 border-red-500/30'
            }`}>
              {effect.scoring.modifier > 0 ? '+' : ''}{effect.scoring.modifier} strokes
            </span>
          )}
        </div>

        {/* Flavor text — zinc-400 on zinc-950 = 8.5:1 */}
        {effect.flavorText && (
          <p className="text-xs italic text-zinc-400">
            &ldquo;{effect.flavorText}&rdquo;
          </p>
        )}

        {/* Inputs section */}
        <div className="space-y-3">
          {/* Target player selection */}
          {needsTarget && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-200">
                {effect.input?.label ?? 'Select target player'}
              </label>
              <Select value={targetPlayerId} onValueChange={(v) => setTargetPlayerId(v ?? '')}>
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                  <SelectValue placeholder="Choose opponent..." />
                </SelectTrigger>
                <SelectContent>
                  {otherPlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Club selection */}
          {inputType === 'club_select' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-200">
                {effect.input?.label ?? 'Select club'}
              </label>
              <Select value={clubName} onValueChange={(v) => setClubName(v ?? '')}>
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                  <SelectValue placeholder="Choose a club..." />
                </SelectTrigger>
                <SelectContent>
                  {GOLF_CLUBS.map((club) => (
                    <SelectItem key={club} value={club}>{club}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Number input */}
          {inputType === 'number_input' && !needsTarget && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-200">
                {effect.input?.label ?? 'Enter a number'}
              </label>
              <Input
                type="number"
                min={0}
                max={20}
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
                className="w-24 bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
          )}

          {error && (
            <p className="text-sm font-medium text-red-400 bg-red-950/50 border border-red-800/50 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={activating}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleActivate}
            disabled={!canSubmit || activating}
            className={isAttack
              ? 'bg-red-600 hover:bg-red-700 text-white font-semibold'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold'
            }
          >
            {activating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating...</>
            ) : isAttack ? (
              <><Swords className="w-4 h-4 mr-2" /> Attack!</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" /> Activate</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
