import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const BUCKET = 'avatars'

// Run bucket provisioning at most once per server process.
let bucketReady: Promise<void> | null = null
async function ensureBucket(supabase: SupabaseClient): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data, error: listError } = await supabase.storage.listBuckets()
      if (listError) throw listError
      if (data?.some((b) => b.name === BUCKET)) return
      const { error: createError } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        allowedMimeTypes: ALLOWED_TYPES,
        fileSizeLimit: MAX_SIZE,
      })
      if (createError && !createError.message.toLowerCase().includes('already exists')) {
        throw createError
      }
      console.log(`[avatar upload] Provisioned Supabase bucket '${BUCKET}'`)
    })().catch((err) => {
      // Reset so a later request can retry
      bucketReady = null
      throw err
    })
  }
  return bucketReady
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, GIF, and WebP images are allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image must be under 5 MB' }, { status: 400 })
  }

  const { supabaseAdmin } = await import('@/lib/supabase')

  try {
    await ensureBucket(supabaseAdmin)
  } catch (err) {
    console.error('[avatar upload] Failed to ensure bucket:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Could not provision storage bucket: ${message}` },
      { status: 500 },
    )
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${user.id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[avatar upload] Supabase upload failed:', uploadError)
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}`, details: uploadError },
      { status: 500 },
    )
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  const avatarUrl = urlData.publicUrl
  console.log('[avatar upload] Success:', { userId: user.id, path, avatarUrl })

  await prisma.user.update({
    where: { id: user.id },
    data: { image: avatarUrl },
  })

  await prisma.playerProfile.upsert({
    where: { userId: user.id },
    update: { avatar: avatarUrl },
    create: { userId: user.id, avatar: avatarUrl },
  })

  revalidatePath('/profile')
  return NextResponse.json({ avatarUrl }, { status: 200 })
}
