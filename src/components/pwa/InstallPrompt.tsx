'use client'

import { useEffect, useState } from 'react'
import { Plus, Share, X } from 'lucide-react'

const DISMISS_KEY = 'ym-install-dismissed'

// Shown only on iOS Safari before install. iOS does not fire beforeinstallprompt,
// so users need an explicit hint to use Share → Add to Home Screen.
// Chrome/Android/Desktop already surface their own native install affordance.
export function InstallPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (typeof window.navigator !== 'undefined' &&
        'standalone' in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
    if (isStandalone) return

    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch {}

    const ua = navigator.userAgent
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as unknown as { MSStream?: unknown }).MSStream
    if (!isIOS) return

    // Hydration-only flag: detected environment is by definition a one-shot
    // setState after mount; no cascading-render concern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true)
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-3 sm:max-w-sm rounded-2xl border border-border bg-background/95 backdrop-blur shadow-xl p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-2 top-2 p-1 rounded-md text-muted-foreground hover:bg-muted"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="text-sm font-heading font-semibold pr-6">Install YourMajor</p>
      <p className="text-xs text-muted-foreground mt-1">
        Add to your home screen for fullscreen access and push notifications.
      </p>
      <ol className="mt-3 space-y-1.5 text-xs text-foreground">
        <li className="flex items-center gap-2">
          <Share className="w-4 h-4 text-[var(--color-primary)]" />
          <span>Tap the Share button in Safari</span>
        </li>
        <li className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-[var(--color-primary)]" />
          <span>Choose &ldquo;Add to Home Screen&rdquo;</span>
        </li>
      </ol>
    </div>
  )
}
