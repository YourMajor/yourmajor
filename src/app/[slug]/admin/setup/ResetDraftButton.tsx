'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, RotateCcw } from 'lucide-react'

interface Props {
  tournamentId: string
}

export function ResetDraftButton({ tournamentId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReset() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/draft/reset`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Failed to reset draft')
        setLoading(false)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Reset Draft
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400">Reset Draft</DialogTitle>
            <DialogDescription>
              This will delete all picks and return the draft to setup. Players will lose any undrafted cards. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleReset}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resetting...</>
              ) : (
                <><RotateCcw className="w-4 h-4 mr-2" /> Reset Draft</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
