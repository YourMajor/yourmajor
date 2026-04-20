'use client'

import { useTransition } from 'react'
import { UserX, UserPlus } from 'lucide-react'
import { LifecycleActionCard } from '../LifecycleActionCard'

export function RegistrationToggle({
  tournamentId,
  registrationClosed,
  toggleAction,
}: {
  tournamentId: string
  registrationClosed: boolean
  toggleAction: (tournamentId: string) => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <LifecycleActionCard
      icon={registrationClosed ? UserPlus : UserX}
      iconColor={registrationClosed ? 'var(--color-primary)' : '#dc2626'}
      label={registrationClosed ? 'Reopen Registration' : 'Close Registration'}
      sublabel={
        registrationClosed
          ? 'Allow players to join again'
          : 'Lock the roster and prevent new signups'
      }
      pending={isPending}
      onClick={() => startTransition(() => toggleAction(tournamentId))}
    />
  )
}
