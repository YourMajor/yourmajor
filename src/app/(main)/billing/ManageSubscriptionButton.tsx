'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreditCard } from 'lucide-react'

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      <CreditCard className="w-4 h-4 mr-1.5" />
      {loading ? 'Loading...' : 'Manage Subscription'}
    </Button>
  )
}
