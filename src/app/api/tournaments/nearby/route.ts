import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * GET /api/tournaments/nearby?lat=X&lng=Y&radius=50
 * Returns open-registration tournaments whose first round's course is within `radius` km.
 */
export async function GET(req: NextRequest) {
  const user = await getUser()

  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = parseFloat(searchParams.get('radius') ?? '50')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  // Fetch all open-registration tournaments, optionally excluding ones
  // the user is already a member of (when authenticated)
  // Public tournaments are discoverable in "Open Near You"
  const tournaments = await prisma.tournament.findMany({
    where: {
      status: { in: ['REGISTRATION', 'ACTIVE'] },
      tournamentType: 'PUBLIC',
      endDate: { gte: new Date() },
      ...(user ? { players: { none: { userId: user.id } } } : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      handicapSystem: true,
      logo: true,
      primaryColor: true,
      status: true,
      startDate: true,
      endDate: true,
      _count: { select: { players: true, rounds: true } },
      rounds: {
        orderBy: { roundNumber: 'asc' },
        take: 1,
        select: {
          course: {
            select: {
              name: true,
              par: true,
              latitude: true,
              longitude: true,
              teeOptions: { select: { name: true }, orderBy: { name: 'asc' } },
            },
          },
        },
      },
    },
  })

  const nearby = tournaments
    .map((t) => {
      const course = t.rounds[0]?.course
      if (!course?.latitude || !course?.longitude) return null
      const distanceKm = haversineKm(lat, lng, course.latitude, course.longitude)
      if (distanceKm > radius) return null
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        handicapSystem: t.handicapSystem,
        logo: t.logo,
        primaryColor: t.primaryColor,
        status: t.status,
        startDate: t.startDate,
        endDate: t.endDate,
        playerCount: t._count.players,
        roundCount: t._count.rounds,
        courseName: course.name,
        coursePar: course.par,
        teeOptions: course.teeOptions.map((t) => t.name),
        distanceKm: Math.round(distanceKm * 10) / 10,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a!.distanceKm - b!.distanceKm)

  return NextResponse.json(nearby)
}
