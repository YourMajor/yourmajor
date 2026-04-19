'use client'

import { useState, useTransition } from 'react'
import { LogOut } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { leaveTournament } from '@/app/[slug]/actions'

interface LeaveTournamentButtonProps {
  slug: string
  className?: string
}

export function LeaveTournamentButton({ slug, className }: LeaveTournamentButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleLeave() {
    startTransition(async () => {
      await leaveTournament(slug)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={className}>
        <LogOut className="w-4 h-4" />
        Leave Tournament
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave this tournament?</DialogTitle>
          <DialogDescription>
            Your registration and any scores you&apos;ve submitted will be removed.
            You can re-register later if registration is still open.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLeave}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Leaving...' : 'Leave Tournament'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
