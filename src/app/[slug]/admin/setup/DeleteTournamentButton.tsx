'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Props {
  tournamentId: string
  tournamentName: string
  size?: 'default' | 'sm'
}

export function DeleteTournamentButton({ tournamentId, tournamentName, size = 'default' }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const canDelete = confirmText === tournamentName

  async function handleDelete() {
    if (!canDelete) return
    setDeleting(true)
    setError('')

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Failed to delete tournament')
        setDeleting(false)
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size={size === 'sm' ? 'sm' : 'default'}
        onClick={() => setOpen(true)}
      >
        {size === 'sm' ? 'Delete' : 'Delete Tournament'}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setConfirmText(''); setError('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tournament?</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All tournament data will be lost, including
              scores, player registrations, photos, chat messages, and draft history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Type <span className="font-bold text-destructive">{tournamentName}</span> to confirm:
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Tournament name"
                autoComplete="off"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!canDelete || deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
