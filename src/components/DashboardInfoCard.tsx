'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, X, ChevronRight } from 'lucide-react'

const STORAGE_KEY = 'yourmajor-info-dismissed'
const DISMISS_EVENT = 'yourmajor-info-dismissed-changed'

function subscribe(cb: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(DISMISS_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

const getSnapshot = () => localStorage.getItem(STORAGE_KEY) === 'true'
// Server / first-paint fallback: treat as dismissed so SSR renders nothing
// and the card only appears after hydration if storage actually says so.
const getServerSnapshot = () => true

export function DashboardInfoCard() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    window.dispatchEvent(new Event(DISMISS_EVENT))
  }

  return (
    <Card className="overflow-hidden border-l-4 relative" style={{ borderLeftColor: 'var(--accent)' }}>
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <CardContent className="py-3 px-4 pr-10">
        <Link href="/features" className="group flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-semibold text-sm">
              Make your next event unforgettable
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Custom branding, live leaderboards, powerup drafts, and season standings — see what YourMajor can do for players, groups, leagues, and courses.
            </p>
            <span className="inline-flex items-center gap-0.5 text-xs font-medium mt-1.5 group-hover:underline" style={{ color: 'var(--accent)' }}>
              See all features
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </Link>
      </CardContent>
    </Card>
  )
}
