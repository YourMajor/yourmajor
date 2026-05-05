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

const IMAGE_VARIANTS = ['default', 'alt', 'gold'] as const

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
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 lg:w-5 lg:h-5 text-white/60" />
        <h2 className="font-heading font-bold text-xl sm:text-2xl lg:text-4xl text-white">Nearby Tournaments</h2>
      </div>
      <p className="text-xs sm:text-sm lg:text-lg text-white/50">
        Open tournaments close to you
      </p>

      {showButton && (
        <button
          type="button"
          onClick={request}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-sm font-medium px-4 py-2.5 transition-colors border border-white/15"
        >
          <MapPin className="w-4 h-4" />
          Find tournaments near me
        </button>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-white/50 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {fetchState === 'loading' ? 'Finding nearby tournaments…' : 'Getting your location…'}
        </div>
      )}

      {(status === 'denied' || status === 'unsupported') && (
        <div className="flex items-center gap-2 text-sm text-white/50 py-2">
          <MapPinOff className="w-4 h-4" />
          Enable location access to see tournaments near you.
        </div>
      )}

      {(status === 'error' || fetchState === 'error') && (
        <p className="text-sm text-white/50 py-2">
          Couldn&apos;t load nearby tournaments. Try again later.
        </p>
      )}

      {fetchState === 'done' && (
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
                <p className="text-sm text-white/50 py-2">
                  No nearby tournaments in this month.
                </p>
              )}

              <p className="text-xs text-white/40">
                Showing open tournaments within 50 km
              </p>
            </div>
          ) : (
            <p className="text-sm text-white/50 py-2">
              No open tournaments within 50 km of your location.
            </p>
          )}
        </>
      )}
    </section>
  )
}
