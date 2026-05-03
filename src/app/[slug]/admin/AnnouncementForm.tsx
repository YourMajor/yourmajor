'use client'

import { useState, useTransition } from 'react'
import { Megaphone, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { sendAnnouncement } from './actions'

const MAX_LEN = 500

export function AnnouncementForm({ tournamentId }: { tournamentId: string }) {
  const [message, setMessage] = useState('')
  const [busy, startTransition] = useTransition()
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const submit = () => {
    if (!message.trim()) return
    setStatus(null)
    const payload = message
    startTransition(async () => {
      const result = await sendAnnouncement(tournamentId, payload)
      if (result.ok) {
        setMessage('')
        setStatus({
          tone: 'success',
          text:
            result.recipients === 0
              ? 'Sent — but no participants are opted in yet.'
              : `Sent to ${result.recipients} ${result.recipients === 1 ? 'device user' : 'device users'}.`,
        })
      } else {
        setStatus({ tone: 'error', text: result.error })
      }
    })
  }

  const remaining = MAX_LEN - message.length

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Send announcement
        </p>
      </div>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
        placeholder="e.g. Tee times posted. First group off at 9:00 sharp."
        rows={3}
        disabled={busy}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground tabular-nums">{remaining} characters left</p>
        <Button onClick={submit} disabled={busy || !message.trim()} size="sm">
          <Send className="w-3.5 h-3.5 mr-1.5" /> {busy ? 'Sending…' : 'Send push'}
        </Button>
      </div>
      {status && (
        <p className={`text-xs ${status.tone === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {status.text}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Goes to participants who have enabled push notifications and opted in to admin announcements
        on their profile.
      </p>
    </div>
  )
}
