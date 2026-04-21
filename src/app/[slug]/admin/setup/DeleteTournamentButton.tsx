'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  tournamentId: string
  tournamentName: string
  size?: 'default' | 'sm'
}

export function DeleteTournamentButton({ tournamentId, tournamentName, size = 'default' }: Props) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    const confirmed = window.confirm(
      'Are you sure you want to delete this tournament? This action is permanent and cannot be undone. All tournament data will be lost.'
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? 'Failed to delete tournament')
        setDeleting(false)
        return
      }
      window.location.href = '/dashboard'
    } catch {
      alert('Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <Button
      variant="destructive"
      size={size === 'sm' ? 'sm' : 'default'}
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? 'Deleting...' : size === 'sm' ? 'Delete' : 'Delete Tournament'}
    </Button>
  )
}
