'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LogOut, CalendarClock } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button-variants'
import { leaveTournament } from '@/app/[slug]/actions'

interface Props {
  slug: string
  isParticipant: boolean
  isLoggedIn: boolean
  status: string
  startDate: string | null
  canRegister: boolean
  inviteToken?: string | null
  registrationClosed?: boolean
}

export function RegistrationBanner({ slug, isParticipant, isLoggedIn, status, startDate, canRegister, inviteToken, registrationClosed }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isPreTournament = status === 'REGISTRATION'
  const isActive = status === 'ACTIVE'
  const registrationOpen = !registrationClosed && status !== 'COMPLETED'

  // Compute days until start
  let daysUntil: number | null = null
  if (startDate && isPreTournament) {
    const now = new Date()
    const start = new Date(startDate)
    daysUntil = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Can always unregister (tournament completed is handled by early return above)
  const canUnregister = true

  function handleConfirm() {
    startTransition(async () => {
      await leaveTournament(slug)
    })
  }

  // Tournament over — nothing to show
  if (status === 'COMPLETED') return null

  // Not registered — show register CTA if registration is open
  if (!isParticipant) {
    if (!registrationOpen || !canRegister) return null

    return (
      <div className="mb-6 p-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Join this tournament</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {inviteToken ? "You've been invited. Sign up to compete." : 'Registration is open. Sign up to compete.'}
          </p>
        </div>
        {isLoggedIn ? (
          <Link
            href={`/${slug}/register${inviteToken ? `?token=${inviteToken}` : ''}`}
            className={buttonVariants({ size: 'sm' }) + ' shrink-0 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'}
          >
            Register
          </Link>
        ) : (
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/${slug}/register${inviteToken ? `?token=${inviteToken}` : ''}`)}`}
            className={buttonVariants({ size: 'sm' }) + ' shrink-0 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'}
          >
            Sign in to Register
          </Link>
        )}
      </div>
    )
  }

  if (!isLoggedIn) return null

  // Registered — show status, scoring message, and unregister option
  return (
    <>
      <div className="mb-6 rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium text-foreground">You are registered.</p>
            {isPreTournament && daysUntil !== null && daysUntil > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="w-3 h-3 shrink-0" />
                Live scoring available {daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}.
              </p>
            )}
            {isPreTournament && daysUntil !== null && daysUntil <= 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="w-3 h-3 shrink-0" />
                Live scoring available once the tournament begins.
              </p>
            )}
            {isPreTournament && daysUntil === null && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="w-3 h-3 shrink-0" />
                Live scoring available when the tournament begins.
              </p>
            )}
          </div>
          {canUnregister && (
            <button
              onClick={() => setOpen(true)}
              className="shrink-0 text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              Unregister
            </button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unregister from tournament?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You will be removed from the player list and any assigned group. You can re-register later if registration is still open.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending ? 'Leaving...' : 'Unregister'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
