'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function FindTournament() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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
      setOpen(false)
      router.push(`/${data.slug}`)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCode(''); setError(null) } }}>
      <DialogTrigger className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors">
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Find Tournament</span>
        <span className="sm:hidden">Find</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Find a Tournament</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Enter the tournament code shared by the organizer.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="e.g. HTT3X9"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null) }}
            maxLength={8}
            autoFocus
            className="text-center text-lg tracking-widest font-mono uppercase"
          />
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <Button
            type="submit"
            disabled={!code.trim() || loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? 'Searching...' : 'Find Tournament'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
