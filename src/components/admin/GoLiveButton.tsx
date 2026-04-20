'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Rocket } from 'lucide-react'
import { LifecycleActionCard } from '@/app/[slug]/admin/LifecycleActionCard'
import { closeRegistrationAndGoLive } from '@/app/[slug]/admin/actions'

interface Props {
  tournamentId: string
  slug: string
}

export function GoLiveButton({ tournamentId, slug }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleGoLive() {
    setConfirmOpen(false)
    startTransition(async () => {
      await closeRegistrationAndGoLive(tournamentId)
      router.refresh()
    })
  }

  return (
    <>
      <LifecycleActionCard
        icon={Rocket}
        iconColor="#16a34a"
        label={isPending ? 'Going Live...' : 'Make Tournament Live'}
        sublabel="Open scoring for all players"
        pending={isPending}
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Tournament Live?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will open scoring for all players. The tournament status will change to <strong>Active</strong>.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleGoLive} disabled={isPending}>
              {isPending ? 'Going Live...' : 'Go Live'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
