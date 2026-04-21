'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserPlus } from 'lucide-react'
import { addLatePlayer } from './groups/actions'

export function QuickAddPlayer({ tournamentId }: { tournamentId: string }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    startTransition(async () => {
      const result = await addLatePlayer(tournamentId, email.trim())
      if (result.ok) {
        setMessage({ type: 'success', text: `Added ${result.player!.name}` })
        setEmail('')
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Failed to add player' })
      }
      setTimeout(() => setMessage(null), 4000)
    })
  }

  return (
    <div className="rounded-xl border border-border px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Add Late Player</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Add a player directly by email. They must already have an account.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="email"
          placeholder="player@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
          disabled={isPending}
        />
        <Button type="submit" size="sm" disabled={isPending || !email.trim()}>
          {isPending ? 'Adding...' : 'Add'}
        </Button>
      </form>
      {message && (
        <p className={`text-xs ${message.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
