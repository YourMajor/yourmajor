'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone } from 'lucide-react'
import { sendLateInvites, setTournamentStatus } from '@/app/(main)/tournaments/new/actions'
import { normalizePhone } from '@/lib/phone'

type InviteEntry = { type: 'email' | 'phone'; value: string }

interface Props {
  slug: string
  tournamentId: string
  status: string
  powerupsEnabled?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AdminBar({ slug, tournamentId, status, powerupsEnabled }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Late entries dialog state
  const [open, setOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [entries, setEntries] = useState<InviteEntry[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [phoneError, setPhoneError] = useState('')

  // End tournament confirm state
  const [confirmEnd, setConfirmEnd] = useState(false)

  function addEmail() {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed) return

    if (!EMAIL_RE.test(trimmed)) { setEmailError('Enter a valid email address.'); return }
    if (entries.some((e) => e.value === trimmed)) { setEmailError('Already added.'); return }

    setEmailError('')
    setEntries([...entries, { type: 'email', value: trimmed }])
    setEmailInput('')
  }

  function addPhone() {
    const trimmed = phoneInput.trim()
    if (!trimmed) return

    const digits = trimmed.replace(/\D/g, '')
    if (digits.length < 10) { setPhoneError('Enter a valid phone number (at least 10 digits).'); return }

    const normalized = normalizePhone(trimmed)
    if (entries.some((e) => e.value === normalized)) { setPhoneError('Already added.'); return }

    setPhoneError('')
    setEntries([...entries, { type: 'phone', value: normalized }])
    setPhoneInput('')
  }

  async function handleSend() {
    if (entries.length === 0) return
    setSending(true)
    await sendLateInvites(tournamentId, entries)
    setSending(false)
    setSent(true)
    setEntries([])
    setTimeout(() => { setSent(false); setOpen(false) }, 2000)
  }

  function handleStatusChange(newStatus: string) {
    startTransition(async () => {
      await setTournamentStatus(tournamentId, newStatus)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-b border-border max-w-5xl mx-auto rounded-md mb-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Admin</span>
        <div className="flex items-center gap-2 ml-auto">
          {status === 'ACTIVE' && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirmEnd(true)}
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              End Tournament
            </Button>
          )}

          {powerupsEnabled && (
            <Link href={`/${slug}/admin/draft`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              Draft
            </Link>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen(true)}
          >
            + Add Late Entries
          </Button>
          <Link href={`/${slug}/admin`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Admin
          </Link>
        </div>
      </div>

      {/* Late entries dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Late Entries</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
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
                <Button type="button" variant="outline" onClick={addEmail}>Add</Button>
              </div>
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Invite by Phone</Label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneInput}
                  onChange={(e) => { setPhoneInput(e.target.value); setPhoneError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhone())}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addPhone}>Add</Button>
              </div>
              {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
            </div>

            {entries.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entries.map((e) => (
                  <Badge key={e.value} variant="secondary" className="gap-1 pr-1">
                    {e.type === 'phone' ? <Phone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                    {e.value}
                    <button type="button" onClick={() => setEntries(entries.filter((x) => x.value !== e.value))} className="ml-0.5 hover:text-destructive text-xs">×</button>
                  </Badge>
                ))}
              </div>
            )}
            {sent ? (
              <p className="text-sm text-green-600 font-medium">Invites sent!</p>
            ) : (
              <Button onClick={handleSend} disabled={sending || entries.length === 0} className="w-full">
                {sending ? 'Sending...' : `Send ${entries.length} Invite${entries.length !== 1 ? 's' : ''}`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* End tournament confirmation */}
      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Tournament?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              This will close scoring and mark the tournament as completed. The leaderboard will be final.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmEnd(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => { handleStatusChange('COMPLETED'); setConfirmEnd(false) }}
              >
                End Tournament
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
