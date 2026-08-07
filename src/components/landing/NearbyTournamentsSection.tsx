'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { MapPin, MapPinOff, Loader2 } from 'lucide-react'
import { DateFilterTabs } from './DateFilterTabs'
import { LandingTournamentCard } from './LandingTournamentCard'
import { useUserLocation } from '@/hooks/useUserLocation'

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

type FetchState = 'idle' | 'loading' | 'done' | 'error'

export function NearbyTournamentsSection() {
  const { coords, status, request } = useUserLocation({ autoRequestWhenGranted: false })
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [tournaments, setTournaments] = useState<NearbyTournament[]>([])
  const [activeMonth, setActiveMonth] = useState('All')

  const loadTournaments = useCallback(async (lat: number, lng: number) => {
    setFetchState('loading')
    try {
      const res = await fetch(`/api/tournaments/nearby?lat=${lat}&lng=${lng}&radius=50`)
      if (!res.ok) throw new Error('fetch failed')
      const data: NearbyTournament[] = await res.json()
      setTournaments(data)
      setFetchState('done')
    } catch {
      setFetchState('error')
    }
  }, [])

  useEffect(() => {
    if (!coords || fetchState !== 'idle') return
    loadTournaments(coords.lat, coords.lng)
  }, [coords, fetchState, loadTournaments])

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

  const isLoading =
    status === 'locating' ||
    (coords !== null && fetchState !== 'done' && fetchState !== 'error')

  const showButton =
    !coords && (status === 'idle' || status === 'prompt' || status === 'granted')

  return (
    <section className="mk-section pt-0">
      <h2>Tournaments near you</h2>
      <p className="mt-4 max-w-[65ch] text-base lg:text-lg" style={{ color: 'var(--mk-text-muted)' }}>
        Open events within 50 km, once you say where you are.
      </p>

      <div className="mt-8 space-y-4">
        {showButton && (
          <button type="button" onClick={request} className="mk-btn mk-btn-secondary">
            <MapPin className="h-4 w-4" aria-hidden />
            Find tournaments near me
          </button>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 py-2 text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            {fetchState === 'loading' ? 'Finding nearby tournaments…' : 'Getting your location…'}
          </div>
        )}

        {(status === 'denied' || status === 'unsupported') && (
          <div className="flex items-center gap-2 py-2 text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
            <MapPinOff className="h-4 w-4" aria-hidden />
            Location is switched off, so this list stays empty. Everything else works without it.
          </div>
        )}

        {(status === 'error' || fetchState === 'error') && (
          <div className="flex items-center gap-4 py-2 text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
            <span>Couldn&apos;t load nearby tournaments.</span>
            <button
              type="button"
              onClick={() => (coords ? loadTournaments(coords.lat, coords.lng) : request())}
              className="underline underline-offset-4"
              style={{ color: 'var(--mk-text-muted)' }}
            >
              Try again
            </button>
          </div>
        )}

        {fetchState === 'done' && (
          <>
            {tournaments.length > 0 ? (
              <div className="space-y-4">
                {availableMonths.length > 2 && (
                  <DateFilterTabs
                    availableMonths={availableMonths}
                    activeMonth={activeMonth}
                    onMonthChange={setActiveMonth}
                  />
                )}

                {filtered.length > 0 ? (
                  <div className="space-y-3">
                    {filtered.map((t) => (
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
                      />
                    ))}
                  </div>
                ) : (
                  <p className="py-2 text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
                    Nothing near you in this month. Try another.
                  </p>
                )}
              </div>
            ) : (
              /* Quiet by design: FeaturedTournaments directly above already
                 carries the dashed invitation and its CTA; repeating the same
                 box here made the page end on visible copy-paste. */
              <p className="py-2 text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
                Nothing public within 50 km yet. The clubhouse fills as
                organisers open their events.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
