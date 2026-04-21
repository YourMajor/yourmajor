'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail } from 'lucide-react'
import { sendLateInvites } from '@/app/(main)/tournaments/new/actions'

type InviteEntry = { type: 'email'; value: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InviteForm({ tournamentId, slug }: { tournamentId: string; slug: string }) {
  const router = useRouter()
  const [emailInput, setEmailInput] = useState('')
  const [entries, setEntries] = useState<InviteEntry[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  function addEmail() {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed) return

    if (!EMAIL_RE.test(trimmed)) { setEmailError('Enter a valid email address.'); return }
    if (entries.some((e) => e.value === trimmed)) { setEmailError('Already added.'); return }

    setEmailError('')
    setEntries([...entries, { type: 'email', value: trimmed }])
    setEmailInput('')
  }

  async function handleSend() {
    if (entries.length === 0) return
    setSending(true)
    await sendLateInvites(tournamentId, entries)
    setSending(false)
    setSent(true)
    setEntries([])
    router.refresh()
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="rounded-xl border border-border p-5 space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Invite by Email</Label>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="player@example.com"
            value={emailInput}
            onChange={(e) => { setEmailInput(e.target.value); setEmailError('') }}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
            className="flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addEmail}>Add</Button>
        </div>
        {emailError && <p className="text-xs text-destructive">{emailError}</p>}
      </div>

      {entries.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {entries.map((e) => (
              <Badge key={e.value} variant="secondary" className="gap-1 pr-1">
                <Mail className="w-3 h-3" />
                {e.value}
                <button
                  type="button"
                  onClick={() => setEntries(entries.filter((x) => x.value !== e.value))}
                  className="ml-0.5 hover:text-destructive text-xs leading-none"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <Button onClick={handleSend} disabled={sending} className="w-full">
            {sending ? 'Sending...' : `Send ${entries.length} Invite${entries.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}

      {sent && <p className="text-sm text-green-600 font-medium">Invites sent!</p>}
    </div>
  )
}
