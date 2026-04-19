'use client'

import Link from 'next/link'
import { Zap } from 'lucide-react'

export function UpgradeBanner({ reasons }: { reasons: string[] }) {
  return (
    <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-heading font-semibold">
        <Zap className="w-4 h-4 text-accent" />
        Pro features selected
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        {reasons.map((r) => (
          <li key={r}>• {r}</li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        These features require <strong>Pro ($29)</strong> for this tournament. You&apos;ll be prompted to upgrade after creating it.{' '}
        <Link href="/pricing" className="underline text-foreground hover:text-accent">
          See all plans
        </Link>
      </p>
    </div>
  )
}
