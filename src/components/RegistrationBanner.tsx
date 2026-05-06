'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LogOut, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button-variants'
import { leaveTournament } from '@/app/[slug]/actions'

interface Props {
  slug: string
  isParticipant: boolean
  isLoggedIn: boolean
  status: string
  canRegister: boolean
  inviteToken?: string | null
  registrationClosed?: boolean
  // Hides the registered tile once the player has started entering scores so
  // the leaderboard isn't cluttered mid-round.
  currentPlayerHolesPlayed?: number
}

export function RegistrationBanner({ slug, isParticipant, isLoggedIn, status, canRegister, inviteToken, registrationClosed, currentPlayerHolesPlayed = 0 }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const registrationOpen = !registrationClosed && status !== 'COMPLETED'

  // Can always unregister (tournament completed is handled by early return above)
  const canUnregister = true

  function handleConfirm() {
    startTransition(async () => {
      await leaveTournament(slug)
    })
  }

  // Tournament over — nothing to show
  if (status === 'COMPLETED') return null

  // Once the player has entered live scoring, hide the registered tile so the
  // leaderboard is the focus. The banner reappears if they unregister.
  if (isParticipant && currentPlayerHolesPlayed > 0) return null

  // Not registered — show register CTA if registration is open
  if (!isParticipant) {
    if (!registrationOpen || !canRegister) return null

    return (
      <div className="p-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 flex items-center justify-between gap-4">
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

  // Registered — single thin line. The "live scoring available when..." copy
  // is already shown by the dedicated tile below the leaderboard, so we don't
  // repeat it here.
  return (
    <>
      <div className="rounded-md border border-border px-3 py-1.5 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5 min-w-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
          <span className="truncate">You are registered</span>
        </p>
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
