'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Navigation, AlertCircle } from 'lucide-react'

type GpsPos = { lat: number; lng: number; accuracy: number; heading: number | null }

export function GpsMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)
  const [pos, setPos] = useState<GpsPos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || !mapContainer.current) return

    async function initMap() {
      const mbModule = await import('mapbox-gl')
      await import('mapbox-gl/dist/mapbox-gl.css')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mb = (mbModule.default ?? mbModule) as any
      mb.accessToken = token

      const map = new mb.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        zoom: 16,
        center: [-98, 39],
      })

      map.on('load', () => setMapLoaded(true))
      mapRef.current = map

      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser.')
        return
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude: lat, longitude: lng, accuracy, heading } = position.coords
          setPos({ lat, lng, accuracy, heading })
          setError(null)

          if (!mapRef.current) return

          if (!markerRef.current) {
            mapRef.current.flyTo({ center: [lng, lat], zoom: 17, speed: 1.5 })
            const el = document.createElement('div')
            el.style.cssText = `
              width:20px;height:20px;
              background:#2563eb;border:3px solid white;
              border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4);
            `
            markerRef.current = new mb.Marker({ element: el })
              .setLngLat([lng, lat])
              .addTo(mapRef.current)
          } else {
            markerRef.current.setLngLat([lng, lat])
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setError('Location access denied. Enable location in your browser settings.')
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setError('Location unavailable. Make sure GPS is enabled.')
          } else {
            setError('Could not get your location.')
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      )
    }

    initMap()

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div ref={mapContainer} className="h-56 w-full bg-muted" />
      <div className="px-4 py-2.5 bg-background border-t border-border flex items-center justify-between gap-3">
        {error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : pos ? (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Navigation className="w-4 h-4 shrink-0 text-blue-500" />
              <span className="font-mono text-xs">
                {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              <span>±{Math.round(pos.accuracy)}m</span>
              {pos.heading !== null && <span>{Math.round(pos.heading)}°</span>}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0 animate-pulse" />
            <span>{mapLoaded ? 'Acquiring GPS signal…' : 'Loading map…'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
