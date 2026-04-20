'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { sendLateInvites, setTournamentStatus } from '@/app/(main)/tournaments/new/actions'

interface Props {
  slug: string
  tournamentId: string
  status: string
  powerupsEnabled?: boolean
}

export function AdminBar({ slug, tournamentId, status, powerupsEnabled }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Late entries dialog state
  const [open, setOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [emails, setEmails] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  // End tournament confirm state
  const [confirmEnd, setConfirmEnd] = useState(false)

  function addEmail() {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Invalid email'); return }
    if (emails.includes(email)) { setEmailError('Already added'); return }
    setEmailError('')
    setEmails([...emails, email])
    setEmailInput('')
  }

  async function handleSend() {
    if (emails.length === 0) return
    setSending(true)
    await sendLateInvites(tournamentId, emails)
    setSending(false)
    setSent(true)
    setEmails([])
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
          <div className="space-y-3 pt-2">
            <Label>Invite by Email</Label>
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
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {emails.map((e) => (
                  <Badge key={e} variant="secondary" className="gap-1 pr-1">
                    {e}
                    <button type="button" onClick={() => setEmails(emails.filter((x) => x !== e))} className="ml-0.5 hover:text-destructive text-xs">×</button>
                  </Badge>
                ))}
              </div>
            )}
            {sent ? (
              <p className="text-sm text-green-600 font-medium">Invites sent!</p>
            ) : (
              <Button onClick={handleSend} disabled={sending || emails.length === 0} className="w-full">
                {sending ? 'Sending...' : `Send ${emails.length} Invite${emails.length !== 1 ? 's' : ''}`}
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
                onClick={() => { setConfirmEnd(false); handleStatusChange('COMPLETED') }}
              >
                {isPending ? 'Ending…' : 'End Tournament'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
