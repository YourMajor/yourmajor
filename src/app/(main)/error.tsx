'use client'

import { useEffect } from 'react'

export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[MainError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
      <h2 className="text-xl font-heading">This page didn&apos;t load</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Nothing was lost. Reload to pick up where you left off; if it keeps
        happening, check your connection.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground"
      >
        Reload this page
      </button>
    </div>
  )
}
