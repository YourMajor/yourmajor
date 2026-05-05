'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, MapPinOff, Loader2 } from 'lucide-react'
import { useUserLocation } from '@/hooks/useUserLocation'

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
  logo: string | null
  primaryColor: string
  accentColor: string
  headerImage: string | null
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

type FetchState = 'idle' | 'loading' | 'done' | 'error'

export default function NearbyTournaments() {
  const { coords, status, request } = useUserLocation()
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [tournaments, setTournaments] = useState<NearbyTournament[]>([])

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

  if (status === 'prompt') {
    return (
      <button
        type="button"
        onClick={request}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-2 transition-colors"
      >
        <MapPin className="w-4 h-4" />
        Use my location to find nearby tournaments
      </button>
    )
  }

  if (status === 'locating' || (status === 'granted' && fetchState !== 'done' && fetchState !== 'error')) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {fetchState === 'loading' ? 'Finding nearby tournaments…' : 'Getting your location…'}
      </div>
    )
  }

  if (status === 'denied' || status === 'unsupported') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <MapPinOff className="w-4 h-4" />
        Enable location access to see tournaments near you.
      </div>
    )
  }

  if (status === 'error' || fetchState === 'error') {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Couldn&apos;t load nearby tournaments. Try again later.
      </p>
    )
  }

  if (fetchState === 'done' && tournaments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No open tournaments within 50 km of your location.
      </p>
    )
  }

  if (fetchState !== 'done') {
    return null
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
            <Card className="hover:shadow-md transition-all cursor-pointer overflow-hidden !py-0 !gap-0">
              {/* Branded header strip */}
              <div
                className="relative px-3 py-2.5 flex items-center"
                style={{
                  background: t.headerImage
                    ? `linear-gradient(to top, ${t.primaryColor}ee, ${t.primaryColor}cc), url(${t.headerImage}) center/cover no-repeat`
                    : `linear-gradient(135deg, ${t.primaryColor}, ${t.primaryColor}dd)`,
                }}
              >
                {/* Accent stripe */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ backgroundColor: t.accentColor }}
                />

                {/* Logo + Name */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {t.logo ? (
                    <Image
                      src={t.logo}
                      alt=""
                      width={40}
                      height={40}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover shrink-0 border-2"
                      style={{ borderColor: t.accentColor }}
                    />
                  ) : (
                    <div
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-base font-heading font-bold text-white shrink-0 border-2"
                      style={{ backgroundColor: `${t.primaryColor}80`, borderColor: t.accentColor }}
                    >
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-heading font-semibold text-white truncate text-sm sm:text-base">{t.name}</p>
                    <p className="text-[11px] text-white/70 truncate">
                      {t.courseName} (Par {t.coursePar}) · {t.distanceKm} km away
                    </p>
                  </div>
                </div>

                {/* Register button */}
                <Link
                  href={`/${t.slug}/register`}
                  onClick={(e) => e.stopPropagation()}
                  className="relative z-10 shrink-0 ml-3 inline-flex items-center rounded-md px-3 py-1.5 text-xs font-bold transition-colors bg-white hover:bg-white/90"
                  style={{ color: t.primaryColor }}
                >
                  Register
                </Link>
              </div>

              {/* Card body */}
              <CardContent className="py-2.5 space-y-1.5">
                {/* Tags */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {dateRange && (
                    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {dateRange}
                    </span>
                  )}
                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {t.playerCount} player{t.playerCount !== 1 ? 's' : ''}
                  </span>
                  <span
                    className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md text-white"
                    style={{ backgroundColor: t.primaryColor }}
                  >
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

                {/* Description */}
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
