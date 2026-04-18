'use client'

import MuiLinearProgress from '@mui/material/LinearProgress'
import { cn } from '@/lib/utils'

function Progress({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<'div'> & { value?: number }) {
  return (
    <div data-slot="progress" className={cn('flex flex-wrap gap-3', className)} {...props}>
      {children}
      <MuiLinearProgress
        variant="determinate"
        value={value ?? 0}
        className="!w-full !rounded-full !h-1"
        color="primary"
      />
    </div>
  )
}

function ProgressTrack({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted', className)}
      data-slot="progress-track"
      {...props}
    />
  )
}

function ProgressIndicator({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="progress-indicator"
      className={cn('h-full bg-primary transition-all', className)}
      {...props}
    />
  )
}

function ProgressLabel({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('text-sm font-medium', className)} data-slot="progress-label" {...props} />
}

function ProgressValue({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('ml-auto text-sm text-muted-foreground tabular-nums', className)} data-slot="progress-value" {...props} />
}

export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue }
