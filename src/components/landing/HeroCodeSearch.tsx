'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function HeroCodeSearch() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/tournaments/find?code=${encodeURIComponent(trimmed)}`)
      if (!res.ok) {
        setError('No tournament found with that code.')
        return
      }
      const data = await res.json()
      router.push(`/${data.slug}`)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 max-w-sm mx-auto">
      <p className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2">
        Have a code?
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <Input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null) }}
            placeholder="Enter tournament code"
            required
            className="pl-9 bg-white/10 border-white/25 text-white placeholder:text-white/50
              focus-visible:border-accent focus-visible:ring-accent/30"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !code.trim()}
          className="bg-accent text-accent-foreground
            hover:bg-accent/90 font-semibold shrink-0"
        >
          {loading ? '...' : 'Go'}
        </Button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-300 text-center">{error}</p>
      )}
    </div>
  )
}
