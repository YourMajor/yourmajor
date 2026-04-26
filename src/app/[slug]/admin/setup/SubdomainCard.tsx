'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateLeagueSubdomain } from './subdomain-actions'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourmajor.app'

export function SubdomainCard({
  tournamentId,
  initialSubdomain,
}: {
  tournamentId: string
  initialSubdomain: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(initialSubdomain ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await updateLeagueSubdomain(tournamentId, value)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(
          result.subdomain
            ? `Subdomain saved. Your league is reachable at ${result.subdomain}.${ROOT_DOMAIN}`
            : 'Subdomain cleared.',
        )
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custom Subdomain</CardTitle>
        <CardDescription>
          Give your league its own URL like <span className="font-mono">yourcrew.{ROOT_DOMAIN}</span>.
          Leave blank to use only the default {ROOT_DOMAIN} URL.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain</Label>
            <div className="flex items-center gap-2">
              <Input
                id="subdomain"
                value={value}
                onChange={(e) => setValue(e.target.value.toLowerCase())}
                placeholder="yourcrew"
                pattern="[a-z0-9-]*"
                disabled={pending}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.{ROOT_DOMAIN}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              3–63 characters. Lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.
            </p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save Subdomain'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
        </form>
      </CardContent>
    </Card>
  )
}
