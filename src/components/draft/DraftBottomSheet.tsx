'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface DraftBottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Optional accessory rendered to the right of the title (e.g. a count badge). */
  titleAccessory?: ReactNode
}

export function DraftBottomSheet({ open, onClose, title, children, titleAccessory }: DraftBottomSheetProps) {
  const triggerRef = useRef<HTMLElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Capture the trigger element so we can return focus on close
  useEffect(() => {
    if (open) {
      triggerRef.current = (document.activeElement as HTMLElement) ?? null
    } else if (triggerRef.current) {
      triggerRef.current.focus?.()
    }
  }, [open])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Auto-focus the close button when sheet opens (focus trap entry)
  useEffect(() => {
    if (!open || !containerRef.current) return
    const focusable = containerRef.current.querySelector<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 animate-backdrop-in"
      />

      {/* Sheet */}
      <div
        ref={containerRef}
        className="absolute bottom-0 left-0 right-0 max-h-[85dvh] flex flex-col bg-background rounded-t-2xl border-t border-border shadow-2xl shadow-black/30 animate-sheet-up"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sheet"
            className="h-1.5 w-10 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-2 shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <h3 className="font-heading font-semibold text-base text-foreground truncate">{title}</h3>
            {titleAccessory}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-11 min-w-11 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}
