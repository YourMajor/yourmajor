'use client'

import { useEffect, useState, useMemo } from 'react'
import { MapPin, MapPinOff, Loader2 } from 'lucide-react'
import { DateFilterTabs } from './DateFilterTabs'
import { LandingTournamentCard } from './LandingTournamentCard'

type NearbyTournament = {
  id: string
  slug: string
  name: string
  description: string | null
  logo: string | null
  status: string
  startDate: string | null
  endDate: string | null
  playerCount: number
  courseName: string
  distanceKm: number
}

const IMAGE_VARIANTS = ['default', 'alt', 'gold'] as const

export function NearbyTournamentsSection() {
  const [state, setState] = useState<'idle' | 'locating' | 'loading' | 'done' | 'denied' | 'error'>('idle')
  const [tournaments, setTournaments] = useState<NearbyTournament[]>([])
  const [activeMonth, setActiveMonth] = useState('All')

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

  const availableMonths = useMemo(() => {
    const months = new Map<string, Date>()
    tournaments.forEach((t) => {
      if (t.startDate) {
        const d = new Date(t.startDate)
        const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        if (!months.has(label)) months.set(label, d)
      }
    })
    const sorted = [...months.entries()]
      .sort((a, b) => a[1].getTime() - b[1].getTime())
      .map(([label]) => label)
    return ['All', ...sorted]
  }, [tournaments])

  const filtered =
    activeMonth === 'All'
      ? tournaments
      : tournaments.filter((t) => {
          if (!t.startDate) return false
          const d = new Date(t.startDate)
          return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) === activeMonth
        })

  const isLoading = state === 'idle' || state === 'locating' || state === 'loading'

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-heading font-semibold text-lg">Nearby Tournaments</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Open tournaments close to you
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {state === 'loading' ? 'Finding nearby tournaments\u2026' : 'Getting your location\u2026'}
        </div>
      )}

      {state === 'denied' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <MapPinOff className="w-4 h-4" />
          Enable location access to see tournaments near you.
        </div>
      )}

      {state === 'error' && (
        <p className="text-sm text-muted-foreground py-2">
          Couldn&apos;t load nearby tournaments. Try again later.
        </p>
      )}

      {state === 'done' && (
        <>
          {tournaments.length > 0 ? (
            <div className="space-y-3">
              {availableMonths.length > 2 && (
                <DateFilterTabs
                  availableMonths={availableMonths}
                  activeMonth={activeMonth}
                  onMonthChange={setActiveMonth}
                />
              )}

              {filtered.length > 0 ? (
                <div className="space-y-3">
                  {filtered.map((t, i) => (
                    <LandingTournamentCard
                      key={t.id}
                      slug={t.slug}
                      name={t.name}
                      description={t.description}
                      logo={t.logo}
                      status={t.status}
                      startDate={t.startDate}
                      endDate={t.endDate}
                      playerCount={t.playerCount}
                      imageVariant={IMAGE_VARIANTS[i % 3]}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No nearby tournaments in this month.
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Showing open tournaments within 50 km
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              No open tournaments within 50 km of your location.
            </p>
          )}
        </>
      )}
    </section>
  )
}
