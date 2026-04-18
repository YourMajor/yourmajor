'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'

interface StatToggleProps {
  label: string
  checked: boolean | null
  onCheckedChange: () => void
  disabled?: boolean
  rejectionTs: number | null
}

export function StatToggle({
  label,
  checked,
  onCheckedChange,
  disabled = false,
  rejectionTs,
}: StatToggleProps) {
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    if (!rejectionTs) return
    setShaking(true)
    const timer = setTimeout(() => setShaking(false), 400)
    return () => clearTimeout(timer)
  }, [rejectionTs])

  return (
    <div
      className={`flex items-center justify-between py-3 ${shaking ? 'animate-shake' : ''}`}
    >
      <span className="text-base font-semibold text-white">{label}</span>
      <Switch
        checked={checked === true}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="data-checked:bg-[var(--color-accent,oklch(0.72_0.11_78))]"
      />
    </div>
  )
}
