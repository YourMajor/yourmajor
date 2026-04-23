'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { resendInvite } from './actions'

export function ResendButton({ invitationId }: { invitationId: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function handleResend() {
    setStatus('sending')
    try {
      await resendInvite(invitationId)
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('idle')
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs h-auto py-1 px-2"
      disabled={status === 'sending'}
      onClick={handleResend}
    >
      {status === 'sending' ? 'Resending...' : status === 'sent' ? 'Sent!' : 'Resend'}
    </Button>
  )
}
