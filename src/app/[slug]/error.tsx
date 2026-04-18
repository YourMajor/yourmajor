'use client'

import { useEffect } from 'react'

export default function TournamentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[TournamentError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
      <h2 className="text-xl font-heading font-bold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        An unexpected error occurred while loading this tournament. Please try again.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium rounded-lg text-white"
        style={{ backgroundColor: 'var(--color-primary, #006747)' }}
      >
        Try again
      </button>
    </div>
  )
}
