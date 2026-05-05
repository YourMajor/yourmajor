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
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      setShowSuccess(true)
      const t = setTimeout(() => setShowSuccess(false), 3000)
      return () => clearTimeout(t)
    }
  }, [state])

  const error = state && 'error' in state ? state.error : null

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
