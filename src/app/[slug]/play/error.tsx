'use client'

import { useEffect } from 'react'

export default function PlayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[PlayError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
      <h2 className="text-xl font-heading font-bold">Scoring Error</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Something went wrong with the scoring interface. Your previously saved scores are safe.
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
