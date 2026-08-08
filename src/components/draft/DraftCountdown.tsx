'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'

interface DraftCountdownProps {
  turnSeconds: number
  /** ISO string from the server */
  turnStartedAt: string
  /** Resets the countdown when the turn advances */
  currentPick: number
  onExpire: () => void
}

export function DraftCountdown({
  turnSeconds,
  turnStartedAt,
  currentPick,
  onExpire,
}: DraftCountdownProps) {
  const [remaining, setRemaining] = useState(() => computeRemaining(turnStartedAt, turnSeconds))
  const expiredRef = useRef(false)

  useEffect(() => {
    // New turn (or new timing config) → reset the expired guard and tick immediately.
    expiredRef.current = false
    const tick = () => {
      const r = computeRemaining(turnStartedAt, turnSeconds)
      setRemaining(r)
      if (r <= 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire()
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [currentPick, turnStartedAt, turnSeconds, onExpire])

  const seconds = Math.max(0, Math.ceil(remaining))
  const isUrgent = seconds <= 10
  const isExpired = seconds === 0
  const pct = Math.max(0, Math.min(100, (remaining / turnSeconds) * 100))

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-semibold ${
        isExpired
          ? 'border-zinc-300 bg-zinc-100 text-zinc-600'
          : isUrgent
          ? 'border-red-300 bg-red-50 text-red-700 animate-pulse'
          : 'border-emerald-300 bg-emerald-50 text-emerald-800'
      }`}
      role="timer"
      aria-live={isUrgent ? 'assertive' : 'polite'}
    >
      <Clock className="w-4 h-4 shrink-0" />
      <div className="flex-1">
        {isExpired ? (
          <span>Time&apos;s up — auto-picking…</span>
        ) : (
          <span>
            {seconds}s to pick
          </span>
        )}
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className={`h-full transition-[width] duration-200 ease-linear ${
              isExpired
                ? 'bg-zinc-400'
                : isUrgent
                ? 'bg-red-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function computeRemaining(turnStartedAt: string, turnSeconds: number): number {
  const startedMs = new Date(turnStartedAt).getTime()
  const elapsed = (Date.now() - startedMs) / 1000
  return Math.max(0, turnSeconds - elapsed)
}
