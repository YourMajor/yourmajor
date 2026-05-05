'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type LocationStatus =
  | 'idle'
  | 'locating'
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'unsupported'
  | 'error'

export interface UserCoords {
  lat: number
  lng: number
}

interface UseUserLocationOptions {
  autoRequestWhenGranted?: boolean
}

interface CachedEntry {
  lat: number
  lng: number
  timestamp: number
}

const CACHE_KEY = 'ym:userLocation'
const CACHE_TTL_MS = 30 * 60 * 1000

function readCache(): UserCoords | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CachedEntry
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null
    return { lat: entry.lat, lng: entry.lng }
  } catch {
    return null
  }
}

function writeCache(coords: UserCoords) {
  try {
    const entry: CachedEntry = { ...coords, timestamp: Date.now() }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // ignore quota / privacy mode failures
  }
}

function initialStatus(): LocationStatus {
  if (typeof window === 'undefined') return 'idle'
  if (readCache()) return 'granted'
  if (!navigator.geolocation) return 'unsupported'
  if (!navigator.permissions?.query) return 'prompt'
  return 'idle'
}

export function useUserLocation(options: UseUserLocationOptions = {}) {
  const { autoRequestWhenGranted = true } = options
  const [coords, setCoords] = useState<UserCoords | null>(() => readCache())
  const [status, setStatus] = useState<LocationStatus>(initialStatus)
  const inFlight = useRef(false)

  const callGeolocation = useCallback(() => {
    if (inFlight.current) return
    inFlight.current = true
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: UserCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        writeCache(next)
        setCoords(next)
        setStatus('granted')
        inFlight.current = false
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error')
        inFlight.current = false
      },
      { timeout: 10000 },
    )
  }, [])

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported')
      return
    }
    callGeolocation()
  }, [callGeolocation])

  useEffect(() => {
    if (status !== 'idle') return
    let cancelled = false
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (cancelled) return
        if (result.state === 'granted') {
          if (autoRequestWhenGranted) callGeolocation()
          else setStatus('granted')
        } else if (result.state === 'denied') {
          setStatus('denied')
        } else {
          setStatus('prompt')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('prompt')
      })
    return () => {
      cancelled = true
    }
  }, [status, autoRequestWhenGranted, callGeolocation])

  return { coords, status, request }
}
