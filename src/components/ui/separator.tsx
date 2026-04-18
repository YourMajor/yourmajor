'use client'

import MuiDivider from '@mui/material/Divider'
import { cn } from '@/lib/utils'

function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<'hr'> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <MuiDivider
      orientation={orientation}
      className={cn(className)}
      {...(props as Record<string, unknown>)}
    />
  )
}

export { Separator }
