'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'

export function PricingActions({ tier }: { tier: 'PRO' | 'LEAGUE' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tier === 'PRO' ? 'PRO' : 'LEAGUE' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (res.status === 401) {
        router.push('/auth/login?next=/pricing')
      }
    } finally {
      setLoading(false)
    }
  }

  if (tier === 'PRO') {
    return (
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={cn(buttonVariants({ size: 'lg' }), 'w-full bg-accent text-accent-foreground hover:bg-accent/90')}
      >
        {loading ? 'Redirecting...' : 'Create Pro Tournament'}
      </button>
    )
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
    >
      {loading ? 'Redirecting...' : 'Get Season Pass'}
    </button>
  )
}
