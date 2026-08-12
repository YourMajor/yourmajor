'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, MapPinOff, Loader2 } from 'lucide-react'
import { TournamentCardGrid, type TournamentData } from './TournamentCardGrid'
import { useUserLocation } from '@/hooks/useUserLocation'

/**
 * One shelf, not two. Featured and local used to be separate sections with
 * separate headings, separate month-grouping logic and separate empty states
 * — and since a featured tournament only exists when we push one out by
 * hand, the first of them was an empty box on the page nearly always.
 *
 * Now there is a single list. Whatever is featured sits at the top of it,
 * marked; the visitor's local events fill in underneath once they say where
 * they are. When there is nothing featured, nothing shows — no placeholder,
 * no apology.
 *
 * Location is still gesture-gated (`autoRequestWhenGranted: false`). This
 * section sits high on the page now, and a permission prompt a visitor did
 * not ask for is hostile wherever it fires.
 */

type FetchState = 'idle' | 'loading' | 'done' | 'error'

export function TournamentsPanel({ featured }: { featured: TournamentData[] }) {
  const { coords, status, request } = useUserLocation({ autoRequestWhenGranted: false })
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [nearby, setNearby] = useState<TournamentData[]>([])

  const loadNearby = useCallback(async (lat: number, lng: number) => {
    setFetchState('loading')
    try {
      const res = await fetch(`/api/tournaments/nearby?lat=${lat}&lng=${lng}&radius=50`)
      if (!res.ok) throw new Error('fetch failed')
      setNearby(await res.json())
      setFetchState('done')
    } catch {
      setFetchState('error')
    }
  }, [])

  useEffect(() => {
    if (!coords || fetchState !== 'idle') return
    loadNearby(coords.lat, coords.lng)
  }, [coords, fetchState, loadNearby])

  // Featured first, then local. A featured event can also be within 50 km of
  // the visitor, so the merge is keyed by id and the featured copy wins —
  // otherwise the same tournament would list twice, once marked and once not.
  const seen = new Set(featured.map((t) => t.id))
  const tournaments: TournamentData[] = [
    ...featured,
    ...nearby.filter((t) => !seen.has(t.id)),
  ]

  const isLoading =
    status === 'locating' ||
    (coords !== null && fetchState !== 'done' && fetchState !== 'error')

  const showButton =
    !coords && (status === 'idle' || status === 'prompt' || status === 'granted')

  return (
    <div>
      {/* Structural label for the list, in the same register as a table
          header — not an eyebrow over a heading (DESIGN.md forbids those).
          The section's own h2 sits above this. */}
      <p className="mk-label" style={{ color: 'var(--mk-gold)' }}>
        Featured &amp; Local
      </p>

      <div className="mt-6 space-y-5">
        {showButton && (
          <button type="button" onClick={request} className="mk-btn mk-btn-secondary">
            <MapPin className="h-4 w-4" aria-hidden />
            Find tournaments near me
          </button>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 py-2 text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            {fetchState === 'loading' ? 'Finding tournaments near you…' : 'Getting your location…'}
          </div>
        )}

        {(status === 'denied' || status === 'unsupported') && (
          <div className="flex items-center gap-2 py-2 text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
            <MapPinOff className="h-4 w-4" aria-hidden />
            Location is switched off, so only featured events show here. Everything
            else works without it.
          </div>
        )}

        {(status === 'error' || fetchState === 'error') && (
          <div className="flex items-center gap-4 py-2 text-sm" style={{ color: 'var(--mk-text-subtle)' }}>
            <span>Couldn&apos;t load tournaments near you.</span>
            <button
              type="button"
              onClick={() => (coords ? loadNearby(coords.lat, coords.lng) : request())}
              className="underline underline-offset-4"
              style={{ color: 'var(--mk-text-muted)' }}
            >
              Try again
            </button>
          </div>
        )}

        {tournaments.length > 0 ? (
          <TournamentCardGrid
            tournaments={tournaments}
            emptyMessage="Nothing in this month. Try another."
          />
        ) : (
          /* One quiet line, never a bordered placeholder: this list is empty
             most of the time by design, and a box that exists only to say so
             is furniture. The invitation is a sentence with a link in it. */
          !isLoading && (
            <p className="max-w-[52ch] py-1 text-sm leading-relaxed" style={{ color: 'var(--mk-text-subtle)' }}>
              {fetchState === 'done'
                ? 'Nothing public within 50 km right now — most groups run their events privately. '
                : 'Public events show up here as organisers open them. '}
              <Link
                href="/auth/signup"
                className="underline underline-offset-4"
                style={{ color: 'var(--mk-text-muted)' }}
              >
                Start one
              </Link>{' '}
              and yours can be the first.
            </p>
          )
        )}
      </div>
    </div>
  )
}
