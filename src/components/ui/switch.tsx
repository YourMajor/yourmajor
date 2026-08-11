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
        // tap-44: the track is only 20-24px tall, well under the touch floor.
        'tap-44 inline-flex shrink-0 items-center rounded-full transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        sm ? 'h-5 w-9' : 'h-6 w-11',
        isOn ? 'bg-primary' : 'bg-muted-foreground/30',
        className
      )}
      {...props}
    >
      {/* The knob takes the guarded foreground when on, so it stays visible
          against a light tournament brand colour; a literal white knob
          disappeared on one. Off, it sits on the muted track instead. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none block rounded-full shadow-sm transition-transform duration-150',
          sm ? 'size-4' : 'size-5',
          isOn ? 'bg-primary-foreground' : 'bg-background',
          isOn ? (sm ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

export { Switch }
