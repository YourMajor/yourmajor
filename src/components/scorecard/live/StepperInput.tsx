'use client'

import { useEffect, useState } from 'react'

interface StepperInputProps {
  label: string
  value: number | null
  onIncrement: () => void
  onDecrement: () => void
  rejectionTs: number | null // timestamp of last rejection -- triggers shake
  size?: 'lg' | 'md'
}

export function StepperInput({
  label,
  value,
  onIncrement,
  onDecrement,
  rejectionTs,
  size = 'lg',
}: StepperInputProps) {
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    if (!rejectionTs) return
    queueMicrotask(() => setShaking(true))
    const timer = setTimeout(() => setShaking(false), 400)
    return () => clearTimeout(timer)
  }, [rejectionTs])

  const btnSize = size === 'lg' ? 'h-14 w-14 text-2xl' : 'h-12 w-12 text-xl'
  const valueSize = size === 'lg' ? 'text-5xl min-w-[4rem]' : 'text-4xl min-w-[3.5rem]'

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-white uppercase tracking-wider">
        {label}
      </p>
      <div
        className={`flex items-center justify-center gap-6 ${shaking ? 'animate-shake' : ''}`}
      >
        <button
          type="button"
          onClick={onDecrement}
          className={`${btnSize} rounded-full bg-white/25 text-white font-bold flex items-center justify-center active:scale-90 active:bg-white/40 transition-all touch-manipulation`}
          aria-label={`Decrease ${label}`}
        >
          &minus;
        </button>
        <span
          className={`${valueSize} font-heading font-bold text-white text-center tabular-nums`}
        >
          {value ?? '-'}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          className={`${btnSize} rounded-full bg-white/25 text-white font-bold flex items-center justify-center active:scale-90 active:bg-white/40 transition-all touch-manipulation`}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}
