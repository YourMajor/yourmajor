'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, X } from 'lucide-react'

export function UpgradeSuccessBanner({ slug }: { slug: string }) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    // Clean up the URL
    router.replace(`/${slug}`, { scroll: false })
  }

  return (
    <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Tournament upgraded to Pro!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You now have access to custom branding, powerups, and all premium features.
            </p>
            <Link
              href={`/${slug}/admin/setup`}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-500 mt-2"
            >
              Add Personalization →
            </Link>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-0.5"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
