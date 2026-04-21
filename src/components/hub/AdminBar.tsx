'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { sendLateInvites, setTournamentStatus } from '@/app/(main)/tournaments/new/actions'

type InviteEntry = { type: 'email' | 'phone'; value: string }

interface Props {
  slug: string
  tournamentId: string
  status: string
  powerupsEnabled?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[\d\s().-]{7,}$/

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

function detectType(input: string): 'email' | 'phone' | null {
  if (EMAIL_RE.test(input)) return 'email'
  const digits = input.replace(/\D/g, '')
  if (digits.length >= 7 && PHONE_RE.test(input)) return 'phone'
  return null
}

export function AdminBar({ slug, tournamentId, status, powerupsEnabled }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Late entries dialog state
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [entries, setEntries] = useState<InviteEntry[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // End tournament confirm state
  const [confirmEnd, setConfirmEnd] = useState(false)

  function addEntry() {
    const trimmed = input.trim()
    if (!trimmed) return

    const type = detectType(trimmed)
    if (!type) { setError('Enter a valid email or phone number'); return }

    const normalized = type === 'phone' ? normalizePhone(trimmed) : trimmed.toLowerCase()
    if (entries.some((e) => e.value === normalized)) { setError('Already added'); return }

    setError('')
    setEntries([...entries, { type, value: normalized }])
    setInput('')
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
          <div className="space-y-3 pt-2">
            <Label>Invite by Email or Phone</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="player@example.com or (555) 123-4567"
                value={input}
                onChange={(e) => { setInput(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEntry())}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={addEntry}>Add</Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {entries.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entries.map((e) => (
                  <Badge key={e.value} variant="secondary" className="gap-1 pr-1">
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
