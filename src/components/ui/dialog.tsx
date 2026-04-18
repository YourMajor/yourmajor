'use client'

import * as React from 'react'
import MuiDialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => {},
})

function Dialog({
  open: controlledOpen,
  onOpenChange,
  children,
  ...props
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [internalOpen, setInternalOpen] = React.useState(props.defaultOpen ?? false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const handleChange = (v: boolean) => {
    if (!isControlled) setInternalOpen(v)
    onOpenChange?.(v)
  }

  return (
    <DialogContext.Provider value={{ open, onOpenChange: handleChange }}>
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({ children, ...props }: React.ComponentProps<'button'>) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    <button type="button" onClick={() => onOpenChange(true)} {...props}>
      {children}
    </button>
  )
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function DialogClose({ children, ...props }: React.ComponentProps<'button'>) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    <button type="button" onClick={() => onOpenChange(false)} {...props}>
      {children}
    </button>
  )
}

function DialogOverlay() {
  return null // MUI Dialog handles its own overlay
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<'div'> & { showCloseButton?: boolean }) {
  const { open, onOpenChange } = React.useContext(DialogContext)

  return (
    <MuiDialog
      open={open}
      onClose={() => onOpenChange(false)}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          className: cn('!rounded-xl !shadow-2xl', className),
          style: { margin: 16 },
        },
      }}
    >
      <div className="relative p-4 sm:p-6" {...props}>
        {children}
        {showCloseButton && (
          <IconButton
            onClick={() => onOpenChange(false)}
            size="small"
            className="!absolute !top-2 !right-2"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" />
          </IconButton>
        )}
      </div>
    </MuiDialog>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 mb-4', className)} {...props} />
}

function DialogFooter({
  className,
  children,
  showCloseButton = false,
  ...props
}: React.ComponentProps<'div'> & { showCloseButton?: boolean }) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 border-t bg-muted/50 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 p-4 sm:flex-row sm:justify-end rounded-b-xl', className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Close
        </button>
      )}
    </div>
  )
}

function DialogTitle({ className, children, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2 className={cn('font-heading text-base leading-none font-medium', className)} {...props}>
      {children}
    </h2>
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
