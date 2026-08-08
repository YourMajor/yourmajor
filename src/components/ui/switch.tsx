'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

function Switch({
  className,
  size = 'default',
  checked,
  onCheckedChange,
  defaultChecked,
  disabled,
  ...props
}: {
  className?: string
  size?: 'sm' | 'default'
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  defaultChecked?: boolean
  disabled?: boolean
  [key: string]: unknown
}) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const isOn = isControlled ? checked : internalChecked

  function toggle() {
    if (!isControlled) setInternalChecked(!isOn)
    onCheckedChange?.(!isOn)
  }

  const sm = size === 'sm'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      disabled={disabled}
      data-slot="switch"
      onClick={toggle}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        sm ? 'h-5 w-9' : 'h-6 w-11',
        isOn ? 'bg-primary' : 'bg-muted-foreground/30',
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow-sm transition-transform duration-150',
          sm ? 'size-4' : 'size-5',
          isOn ? (sm ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

export { Switch }
