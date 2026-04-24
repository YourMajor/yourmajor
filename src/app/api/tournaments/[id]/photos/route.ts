import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import { containsProfanity } from '@/lib/content-moderation'
import { randomUUID } from 'crypto'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
  'image/avif',
]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a tournament participant' }, { status: 403 })

  const photos = await prisma.tournamentPhoto.findMany({
    where: { tournamentId: id },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  })
  return NextResponse.json(photos)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify tournament tier allows gallery
  const tier = await getTournamentTier(id)
  if (!TIER_LIMITS[tier].gallery) {
    return NextResponse.json({ error: 'Photo gallery requires a paid plan' }, { status: 403 })
  }

  // Verify user is a registered player
  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a tournament participant' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const caption = (form.get('caption') as string | null)?.trim() ?? null

  if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 })

  // Language filter for captions in publicly discoverable tournaments — run before upload
  // so we don't orphan a Supabase blob when the caption is rejected.
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { tournamentType: true },
  })
  if (tournament?.tournamentType === 'PUBLIC' && containsProfanity(caption)) {
    return NextResponse.json(
      { error: 'Caption contains inappropriate language.' },
      { status: 400 },
    )
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'File too large — maximum size is 10 MB' },
      { status: 400 }
    )
  }

  // Validate file type — accept the file if the MIME type is in the list,
  // or if it starts with "image/" (covers edge cases like camera-specific types)
  if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Unsupported file type — please upload a JPEG, PNG, GIF, WebP, or HEIC image' },
      { status: 400 }
    )
  }

  const { supabaseAdmin } = await import('@/lib/supabase')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${id}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabaseAdmin.storage
    .from('tournament-photos')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) {
    console.error('Supabase upload error:', error.message)
    return NextResponse.json(
      { error: `Upload failed: ${error.message}` },
      { status: 500 }
    )
  }

  const { data: urlData } = supabaseAdmin.storage.from('tournament-photos').getPublicUrl(path)

  const photo = await prisma.tournamentPhoto.create({
    data: { tournamentId: id, userId: user.id, url: urlData.publicUrl, caption },
    include: { user: { select: { name: true } } },
  })

  return NextResponse.json(photo, { status: 201 })
}
