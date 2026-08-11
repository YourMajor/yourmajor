'use client'

import { useEffect } from 'react'

export default function PlayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[PlayError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
      <h2 className="text-xl font-heading">Scoring hit a snag</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Every score you saved is safe, and unsaved entries retry on their own
        once you&apos;re back. Reload to keep scoring.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground"
      >
        Back to scoring
      </button>
    </div>
  )
}
