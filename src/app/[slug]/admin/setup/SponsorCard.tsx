'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateSponsor } from './sponsor-actions'

export function SponsorCard({
  tournamentId,
  initialName,
  initialLogoUrl,
  initialLink,
  isLeagueRoot,
  isLeagueChild,
  rootSponsorName,
}: {
  tournamentId: string
  initialName: string | null
  initialLogoUrl: string | null
  initialLink: string | null
  isLeagueRoot: boolean
  isLeagueChild: boolean
  rootSponsorName: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateSponsor(tournamentId, fd)
      if ('error' in result) setError(result.error)
      else {
        setSuccess('Sponsor saved.')
        router.refresh()
      }
    })
  }

  const description = isLeagueRoot
    ? 'Set a sponsor for the whole league. Each event in the league will show this sponsor unless overridden on the event itself.'
    : isLeagueChild
      ? rootSponsorName
        ? `Override the league's sponsor (${rootSponsorName}) for this event only. Leave blank to use the league sponsor.`
        : 'Set a sponsor for this single event. The parent league has no sponsor configured.'
      : 'Set a sponsor for this tournament. It appears as a small attribution under the leaderboard header.'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sponsor</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sponsorName">Sponsor Name</Label>
            <Input
              id="sponsorName"
              name="sponsorName"
              defaultValue={initialName ?? ''}
              placeholder="e.g. Eagle Pro Shop"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to clear the sponsor.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sponsorLogoUrl">Logo URL (optional)</Label>
            <Input
              id="sponsorLogoUrl"
              name="sponsorLogoUrl"
              type="url"
              defaultValue={initialLogoUrl ?? ''}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sponsorLink">Link (optional)</Label>
            <Input
              id="sponsorLink"
              name="sponsorLink"
              type="url"
              defaultValue={initialLink ?? ''}
              placeholder="https://example.com"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save Sponsor'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
        </form>
      </CardContent>
    </Card>
  )
}
