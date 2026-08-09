'use client'

import { useEffect } from 'react'

export default function TournamentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[TournamentError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
      <h2 className="text-xl font-heading font-bold">This tournament page didn&apos;t load</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        The rest of the tournament is unaffected. If you&apos;re on the course with a
        weak signal, reloading usually fixes it.
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
