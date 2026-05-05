'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { UpdateTournamentState } from './actions'

interface Props {
  action: (prevState: UpdateTournamentState, formData: FormData) => Promise<UpdateTournamentState>
  children: React.ReactNode
}

export function SettingsSaveForm({ action, children }: Props) {
  const [state, formAction, pending] = useActionState<UpdateTournamentState, FormData>(action, null)
  // Track which success-state instance has been dismissed so the message hides
  // 3s after each new save without calling setState synchronously in an effect.
  const [dismissed, setDismissed] = useState<UpdateTournamentState>(null)
  const isOk = state !== null && 'ok' in state && state.ok === true
  const showSuccess = isOk && dismissed !== state

  useEffect(() => {
    if (!showSuccess) return
    const t = setTimeout(() => setDismissed(state), 3000)
    return () => clearTimeout(t)
  }, [showSuccess, state])

  const error = state !== null && 'error' in state ? state.error : null

  return (
    <form action={formAction} className="space-y-6">
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {showSuccess && <p className="text-sm text-emerald-600">Saved.</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  )
}
