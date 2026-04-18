'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MapPinOff, Loader2 } from 'lucide-react'

const HCP_LABELS: Record<string, string> = {
  NONE: 'No Handicap',
  WHS: 'WHS',
  STABLEFORD: 'Stableford',
  CALLAWAY: 'Callaway',
  PEORIA: 'Peoria',
}

type NearbyTournament = {
  id: string
  slug: string
  name: string
  description: string | null
  handicapSystem: string
  status: string
  startDate: string | null
  endDate: string | null
  playerCount: number
  roundCount: number
  courseName: string
  coursePar: number
  teeOptions: string[]
  distanceKm: number
}

export default function NearbyTournaments() {
  const [state, setState] = useState<'idle' | 'locating' | 'loading' | 'done' | 'denied' | 'error'>('idle')
  const [tournaments, setTournaments] = useState<NearbyTournament[]>([])

  useEffect(() => {
    if (!navigator.geolocation) {
      setState('denied')
      return
    }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setState('loading')
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `/api/tournaments/nearby?lat=${latitude}&lng=${longitude}&radius=50`
          )
          if (!res.ok) throw new Error('fetch failed')
          const data: NearbyTournament[] = await res.json()
          setTournaments(data)
          setState('done')
        } catch {
          setState('error')
        }
      },
      () => setState('denied'),
      { timeout: 10000 }
    )
  }, [])

  if (state === 'idle' || state === 'locating' || state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {state === 'loading' ? 'Finding nearby tournaments…' : 'Getting your location…'}
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <MapPinOff className="w-4 h-4" />
        Enable location access to see tournaments near you.
      </div>
    )
  }

  if (state === 'error') {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Couldn&apos;t load nearby tournaments. Try again later.
      </p>
    )
  }

  if (tournaments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No open tournaments within 50 km of your location.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {tournaments.map((t) => {
        const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const dateRange = t.startDate && t.endDate
          ? `${fmtDate(t.startDate)} – ${fmtDate(t.endDate)}`
          : t.startDate ? fmtDate(t.startDate) : null

        return (
          <Link key={t.id} href={`/${t.slug}`} className="block">
            <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer border-l-4 border-l-primary">
              <CardContent className="py-4 space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.courseName} (Par {t.coursePar}) · {t.distanceKm} km away
                      {` · ${t.playerCount} player${t.playerCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {/* Register button stops propagation so it doesn't trigger the card link */}
                  <Link
                    href={`/${t.slug}/register`}
                    onClick={(e) => e.stopPropagation()}
                    className={buttonVariants({ size: 'sm' }) + ' relative z-10 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0'}
                  >
                    Register
                  </Link>
                </div>

              {/* Tournament details */}
              <div className="flex flex-wrap gap-1.5">
                {dateRange && (
                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {dateRange}
                  </span>
                )}
                <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {HCP_LABELS[t.handicapSystem] ?? t.handicapSystem}
                </span>
                <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {t.roundCount} round{t.roundCount !== 1 ? 's' : ''}
                </span>
                {t.teeOptions.length > 0 && (
                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    Tees: {t.teeOptions.join(', ')}
                  </span>
                )}
              </div>

              {t.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
              )}
            </CardContent>
          </Card>
          </Link>
        )
      })}
      <p className="text-xs text-muted-foreground">Showing open tournaments within 50 km</p>
    </div>
  )
}
