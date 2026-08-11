'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root

function DialogTrigger({ children, ...props }: React.ComponentProps<'button'>) {
  return (
    <DialogPrimitive.Trigger asChild>
      <button type="button" {...props}>
        {children}
      </button>
    </DialogPrimitive.Trigger>
  )
}

const DialogPortal = DialogPrimitive.Portal

function DialogClose({ children, ...props }: React.ComponentProps<'button'>) {
  return (
    <DialogPrimitive.Close asChild>
      <button type="button" {...props}>
        {children}
      </button>
    </DialogPrimitive.Close>
  )
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/50',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<'div'> & { showCloseButton?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-background shadow-2xl',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className
        )}
        {...props}
      >
        <div className="relative p-4 sm:p-6">
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label="Close"
            >
              <XIcon className="w-4 h-4" />
            </DialogPrimitive.Close>
          )}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
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
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 border-t bg-muted/50 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 mt-4 p-4 sm:flex-row sm:justify-end rounded-b-xl', className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('font-semibold text-base leading-none font-medium', className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Title>
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
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
