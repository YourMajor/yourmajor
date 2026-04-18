'use client'

import type { HoleData } from './useLiveScoringState'

interface HoleOverviewProps {
  hole: HoleData
  teeName?: string
  teeColor?: string
  courseLatitude?: number | null
  courseLongitude?: number | null
}

/**
 * Build a Mapbox Static API URL for a satellite birds-eye view.
 * Uses a high zoom for a close aerial feel centered on the course.
 */
function getSatelliteUrl(lat: number, lng: number, width = 600, height = 900): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token || token.length < 20) return null
  // Zoom 17 gives a nice hole-level aerial view
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},17,0/${width}x${height}@2x?access_token=${token}`
}

export function HoleOverview({ hole, teeName, teeColor, courseLatitude, courseLongitude }: HoleOverviewProps) {
  const satelliteUrl = courseLatitude && courseLongitude
    ? getSatelliteUrl(courseLatitude, courseLongitude)
    : null

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center overflow-hidden">
      {/* Satellite background */}
      {satelliteUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={satelliteUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Dark overlay so text remains readable */}
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}

      {/* Content — overlaid on satellite or plain background */}
      <div className="relative z-10 px-6">
        {/* Hole badge */}
        <p className="text-sm font-bold text-white/80 uppercase tracking-widest mb-2">
          Hole {hole.number}
        </p>

        {/* Hero yardage */}
        {hole.yards ? (
          <>
            <p className="text-8xl font-heading font-black text-white tabular-nums leading-none drop-shadow-lg">
              {hole.yards}
            </p>
            <p className="text-lg text-white/80 font-medium mt-2 drop-shadow">yards</p>
          </>
        ) : (
          <p className="text-4xl font-heading font-bold text-white/70">
            No yardage data
          </p>
        )}

        {/* Details */}
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-center gap-6 text-sm text-white/90">
            <span className="drop-shadow">
              Par <span className="font-bold text-white text-lg">{hole.par}</span>
            </span>
            {hole.handicap !== null && (
              <span className="drop-shadow">
                HCP{' '}
                <span className="font-bold text-white text-lg">
                  {hole.handicap}
                </span>
              </span>
            )}
          </div>

          {teeName && (
            <div className="flex items-center justify-center gap-2 text-sm text-white/80 drop-shadow">
              {teeColor && (
                <span
                  className="w-3 h-3 rounded-full border border-white/30"
                  style={{ backgroundColor: teeColor }}
                />
              )}
              <span>{teeName} Tees</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
