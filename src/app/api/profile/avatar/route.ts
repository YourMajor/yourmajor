import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

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

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${user.id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = urlData.publicUrl

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
