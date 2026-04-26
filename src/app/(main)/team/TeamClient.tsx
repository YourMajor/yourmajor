'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { inviteCoAdmin, removeCoAdmin } from './actions'

type CoAdmin = {
  id: string
  email: string
  name: string | null
  invitedEmail: string | null
  acceptedAt: Date | null
}

export function TeamClient({
  coAdmins,
  remainingSeats,
  totalSeats,
  ownerEmail,
}: {
  coAdmins: CoAdmin[]
  remainingSeats: number
  totalSeats: number
  ownerEmail: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await inviteCoAdmin(email)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(`Invited ${email}.`)
        setEmail('')
        router.refresh()
      }
    })
  }

  const handleRemove = (id: string) => {
    if (!confirm('Remove this co-admin? They will lose admin access to all your tournaments.')) return
    startTransition(async () => {
      const result = await removeCoAdmin(id)
      if ('error' in result) setError(result.error)
      else router.refresh()
    })
  }

  const canInvite = remainingSeats > 0

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Seats</CardTitle>
          <CardDescription>
            {totalSeats === 1
              ? 'Co-admins are available on the Club and Tour plans.'
              : `You're using ${coAdmins.length + 1} of ${totalSeats} admin seats (you + ${coAdmins.length} co-admin${coAdmins.length === 1 ? '' : 's'}).`}
          </CardDescription>
        </CardHeader>
      </Card>

      {totalSeats > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a Co-Admin</CardTitle>
            <CardDescription>
              Co-admins inherit admin rights on every tournament and league you own. The invitee must already have a YourMajor account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="coadmin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending || !canInvite}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={pending || !canInvite}>
                {pending ? 'Inviting…' : 'Invite'}
              </Button>
            </form>
            {!canInvite && (
              <p className="text-sm text-muted-foreground mt-3">
                You&apos;ve used all your admin seats. Upgrade to the Tour plan for 5 seats.
              </p>
            )}
            {error && <p className="text-sm text-destructive mt-3">{error}</p>}
            {success && <p className="text-sm text-emerald-600 mt-3">{success}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current Admins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">{ownerEmail}</p>
              <p className="text-xs text-muted-foreground">Account owner</p>
            </div>
            <span className="text-xs text-muted-foreground">Owner</span>
          </div>

          {coAdmins.map((ca) => (
            <div key={ca.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">{ca.name ?? ca.email}</p>
                <p className="text-xs text-muted-foreground">{ca.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(ca.id)}
                disabled={pending}
              >
                Remove
              </Button>
            </div>
          ))}

          {coAdmins.length === 0 && totalSeats > 1 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No co-admins yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
