import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import { containsProfanity } from '@/lib/content-moderation'
import { randomUUID } from 'crypto'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
}
// Note: image/svg+xml deliberately excluded — SVGs can embed <script> and
// would execute as XSS when served from a public bucket.
const ALLOWED_TYPES = Object.keys(MIME_TO_EXT)

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
  const maxPhotos = TIER_LIMITS[tier].maxPhotos
  if (maxPhotos <= 0) {
    return NextResponse.json({ error: 'Photo gallery requires a paid plan' }, { status: 403 })
  }

  // Verify user is a registered player
  const player = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId: user.id } },
  })
  if (!player) return NextResponse.json({ error: 'Not a tournament participant' }, { status: 403 })

  // Enforce per-tier photo count cap
  const existingPhotoCount = await prisma.tournamentPhoto.count({ where: { tournamentId: id } })
  if (existingPhotoCount >= maxPhotos) {
    return NextResponse.json(
      { error: `Photo limit reached (${maxPhotos} photos for ${tier}). Upgrade for more storage.` },
      { status: 403 },
    )
  }

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

  // Validate file type strictly against the allowlist — no startsWith() escape
  // hatch, since that would let through image/svg+xml and arbitrary image/*
  // subtypes we don't have an extension mapping for.
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type — please upload a JPEG, PNG, GIF, WebP, HEIC, BMP, TIFF, or AVIF image' },
      { status: 400 }
    )
  }

  const { supabaseAdmin } = await import('@/lib/supabase')
  // Derive the storage extension from the validated MIME type, not the
  // user-supplied filename — otherwise an attacker can upload an image with
  // contentType=image/jpeg but filename=evil.html and end up with an .html
  // path served from the public bucket.
  const ext = MIME_TO_EXT[file.type] ?? 'bin'
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
