'use client'

import MuiSwitch from '@mui/material/Switch'
import { cn } from '@/lib/utils'

function Switch({
  className,
  size = 'default',
  checked,
  onCheckedChange,
  defaultChecked,
  ...props
}: {
  className?: string
  size?: 'sm' | 'default'
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  defaultChecked?: boolean
  disabled?: boolean
  name?: string
  [key: string]: unknown
}) {
  return (
    <MuiSwitch
      size={size === 'sm' ? 'small' : 'medium'}
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={(_, v) => onCheckedChange?.(v)}
      className={cn(className)}
      color="primary"
      {...props}
    />
  )
}

export { Switch }
