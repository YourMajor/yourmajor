'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Check, X } from 'lucide-react'

export interface PendingConfirmation {
  playerPowerupId: string
  slug: string
  name: string
  prompt: string
  modifierIfYes: number
  contextHoleNumber: number
  targetPlayerName: string | null
  inputKind: 'yes_no' | 'count'
  cap: number | null
}

interface Props {
  confirmation: PendingConfirmation | null
  /** Resolve handler — receives the chosen modifier (modifierIfYes or 0).
   *  Returns true on success so the queue can advance. */
  onAnswer: (playerPowerupId: string, modifier: number) => Promise<boolean>
  /** Skip / decide later — close without resolving. The confirmation will
   *  re-surface on the next score save or visibility change. */
  onDefer: () => void
}

/** Clamp magnitude — positive cap → upper bound, negative cap → lower bound. */
function clampToCap(value: number, cap: number | null): number {
  if (cap === null) return value
  return cap < 0 ? Math.max(cap, value) : Math.min(cap, value)
}

export function PendingConfirmationModal({ confirmation, onAnswer, onDefer }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countValue, setCountValue] = useState('')

  if (!confirmation) return null

  const isCount = confirmation.inputKind === 'count'
  const isAttack = isCount ? true : confirmation.modifierIfYes > 0
  // For attacks the responder is the target; the prompts are already in
  // first-person ("Did you ...") so no name substitution is needed.
  const promptWithName = confirmation.prompt
  const attackerName = isAttack ? confirmation.targetPlayerName : null

  async function handleYesNo(answer: 'yes' | 'no') {
    if (!confirmation) return
    setSubmitting(true)
    setError(null)
    const modifier = answer === 'yes' ? confirmation.modifierIfYes : 0
    try {
      const ok = await onAnswer(confirmation.playerPowerupId, modifier)
      if (!ok) setError('Failed to record answer. Try again.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record answer.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCountSubmit() {
    if (!confirmation) return
    const parsed = parseInt(countValue, 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a non-negative number.')
      return
    }
    setSubmitting(true)
    setError(null)
    const modifier = clampToCap(parsed * confirmation.modifierIfYes, confirmation.cap)
    try {
      const ok = await onAnswer(confirmation.playerPowerupId, modifier)
      if (!ok) setError('Failed to record answer. Try again.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record answer.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !submitting) onDefer() }}>
      <DialogContent className={`max-w-sm border-2 bg-zinc-950 ${isAttack ? 'border-red-600/60' : 'border-emerald-600/60'}`}>
        <div className="flex items-start gap-3 pt-1">
          <div className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-2xl ${
            isAttack ? 'bg-red-600/20 border-2 border-red-500/50' : 'bg-emerald-600/20 border-2 border-emerald-500/50'
          }`}>
            {isAttack ? '⚔️' : '⚡'}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${isAttack ? 'text-red-400' : 'text-emerald-400'}`}>
              {isAttack && attackerName
                ? `${attackerName} attacked you · Hole ${confirmation.contextHoleNumber}`
                : `Confirm result · Hole ${confirmation.contextHoleNumber}`}
            </p>
            <h2 className="text-lg font-heading font-bold text-white leading-snug mt-0.5">
              {confirmation.name}
            </h2>
          </div>
        </div>

        <p className="text-sm text-zinc-200 leading-relaxed">
          {promptWithName}
        </p>

        {isCount ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={confirmation.cap !== null && confirmation.cap > 0 ? confirmation.cap : 20}
                value={countValue}
                onChange={(e) => setCountValue(e.target.value)}
                placeholder="0"
                className="w-24 bg-zinc-900 border-zinc-700 text-white"
              />
              <span className="text-xs text-red-300">
                +{confirmation.modifierIfYes} each
                {confirmation.cap !== null ? ` · max +${Math.abs(confirmation.cap)}` : ''}
              </span>
            </div>
          </>
        ) : (
          <div className={`text-xs ${isAttack ? 'text-red-300' : 'text-emerald-300'}`}>
            Answering <span className="font-bold">Yes</span> applies{' '}
            <span className="font-bold">
              {confirmation.modifierIfYes > 0 ? '+' : ''}{confirmation.modifierIfYes}
            </span>{' '}
            to your score. No → no change.
          </div>
        )}

        {error && (
          <p className="text-sm font-medium text-red-400 bg-red-950/50 border border-red-800/50 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <DialogFooter className="flex-col gap-2 pt-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onDefer}
            disabled={submitting}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Decide later
          </Button>
          {isCount ? (
            <Button
              onClick={handleCountSubmit}
              disabled={submitting || countValue === ''}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Apply
            </Button>
          ) : (
            <>
              <Button
                onClick={() => handleYesNo('no')}
                disabled={submitting}
                variant="outline"
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                <X className="w-4 h-4 mr-2" /> No
              </Button>
              <Button
                onClick={() => handleYesNo('yes')}
                disabled={submitting}
                className={isAttack
                  ? 'bg-red-600 hover:bg-red-700 text-white font-semibold'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold'
                }
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Yes
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
