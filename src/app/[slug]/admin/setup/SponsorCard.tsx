'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { updateSponsor } from './sponsor-actions'

export function SponsorCard({
  tournamentId,
  initialName,
  initialLogoUrl,
  initialBannerUrl,
  initialLink,
  isLeagueRoot,
  isLeagueChild,
  rootSponsorName,
}: {
  tournamentId: string
  initialName: string | null
  initialLogoUrl: string | null
  initialBannerUrl: string | null
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

          <Separator />

          <div className="space-y-2">
            <Label>Logo</Label>
            {initialLogoUrl && (
              <Image
                src={initialLogoUrl}
                alt="Sponsor logo"
                width={120}
                height={40}
                className="h-10 w-auto object-contain"
                unoptimized
              />
            )}
            <Input
              id="sponsorLogoUrl"
              name="sponsorLogoUrl"
              type="url"
              defaultValue={initialLogoUrl ?? ''}
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-muted-foreground">Paste a URL or upload an image. If you upload, the new file replaces the URL.</p>
            <Input id="sponsorLogoFile" name="sponsorLogoFile" type="file" accept="image/*" />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Banner</Label>
            <p className="text-xs text-muted-foreground">
              Optional wide background image shown behind the sponsor attribution.
              The sponsor name and logo appear overlaid on top.
            </p>
            {initialBannerUrl && (
              <div className="relative h-20 w-full rounded-md overflow-hidden">
                <Image
                  src={initialBannerUrl}
                  alt="Sponsor banner"
                  fill
                  sizes="(max-width: 640px) 100vw, 600px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <Input
              id="sponsorBannerUrl"
              name="sponsorBannerUrl"
              type="url"
              defaultValue={initialBannerUrl ?? ''}
              placeholder="https://example.com/banner.png"
            />
            <Input id="sponsorBannerFile" name="sponsorBannerFile" type="file" accept="image/*" />
          </div>

          <Separator />

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
