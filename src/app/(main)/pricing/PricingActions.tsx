'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PricingActions({ tier }: { tier: 'PRO' | 'CLUB' | 'LEAGUE' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tier }),
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

  const labels: Record<string, string> = {
    PRO: 'Create Pro Tournament',
    CLUB: 'Start a League',
    LEAGUE: 'Get Annual Pass',
  }

  // One button style across the tiers. The old per-tier fills (gold for Pro,
  // emerald for Club, crimson for Tour) came from the application palette and
  // broke two rules of the marketing world at once: gold is a rule and never a
  // fill, and there is no second or third brand hue. The tier is told by the
  // card, not by the button.
  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="mk-btn mk-btn-primary-plate w-full"
    >
      {loading ? 'Redirecting...' : labels[tier]}
    </button>
  )
}
