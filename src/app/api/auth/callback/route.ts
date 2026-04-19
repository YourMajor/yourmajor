import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=1`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user?.email) {
    return NextResponse.redirect(`${origin}/auth/login?error=1`)
  }

  const meta = data.user.user_metadata ?? {}
  const name = meta.full_name ?? meta.name ?? data.user.email.split('@')[0]
  const avatarUrl = meta.avatar_url ?? meta.picture ?? null

  // Sync user to Prisma DB — non-blocking so auth still succeeds on DB errors
  try {
    const user = await prisma.user.upsert({
      where: { email: data.user.email },
      create: {
        id: data.user.id,
        email: data.user.email,
        name,
        image: avatarUrl,
      },
      update: {
        name: undefined,
        image: undefined,
      },
    })

    const updates: { name?: string; image?: string } = {}
    if (!user.name && name) updates.name = name
    if (!user.image && avatarUrl) updates.image = avatarUrl
    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: updates })
    }

    const existingProfile = await prisma.playerProfile.findUnique({
      where: { userId: user.id },
    })
    if (!existingProfile && avatarUrl) {
      await prisma.playerProfile.create({
        data: {
          userId: user.id,
          avatar: avatarUrl,
          displayName: name,
        },
      })
    }
  } catch (e) {
    console.error('Failed to sync user to database:', e)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
