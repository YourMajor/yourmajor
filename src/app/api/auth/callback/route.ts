import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { safeNextPath } from '@/lib/safe-redirect'
import { claimMirrorUser } from '@/lib/auth'

function errorRedirect(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(reason)}`)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error_description') ?? searchParams.get('error')
  const type = searchParams.get('type')
  // Recovery emails from Supabase include type=recovery — force the user to
  // /auth/reset-password even if the email template didn't pass an explicit next.
  // safeNextPath: `next` is attacker-controlled and is concatenated onto the
  // origin below, so an off-origin value here is an open redirect on the
  // post-OAuth landing page.
  const explicitNext = searchParams.get('next')
  const fallback = type === 'recovery' ? '/auth/reset-password' : '/dashboard'
  const next = safeNextPath(explicitNext, fallback)

  if (oauthError) {
    console.error('[auth/callback] provider error:', oauthError)
    return errorRedirect(origin, `provider: ${oauthError}`)
  }

  if (!code) {
    return errorRedirect(origin, 'no_code')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user?.email) {
    console.error('[auth/callback] exchangeCodeForSession failed:', error?.message, error?.status)
    return errorRedirect(origin, `exchange: ${error?.message ?? 'no_user'}`)
  }

  const meta = data.user.user_metadata ?? {}
  const name = meta.full_name ?? meta.name ?? data.user.email.split('@')[0]
  const avatarUrl = meta.avatar_url ?? meta.picture ?? null

  // Sync user to Prisma DB before redirecting — the dashboard server-renders
  // getUser(), so the row must exist first.
  //
  // The auth identity is resolved *before* anything keyed on the email. This
  // callback is also where a confirmed email change lands, and there the
  // address is new while the row is not: an email-keyed upsert would find
  // nothing and try to create a second row on a primary key the account
  // already holds.
  try {
    const user =
      (await claimMirrorUser(data.user.id, data.user.email!)) ??
      (await prisma.user.create({
        data: {
          id: data.user.id,
          authUserId: data.user.id,
          email: data.user.email!,
          name,
          image: avatarUrl,
        },
      }))

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
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[auth/callback] db sync failed:', msg, e)
    const compact = msg.replace(/__TURBOPACK__[^\s`]+/g, '<turbopack>').replace(/\s+/g, ' ').trim()
    return errorRedirect(origin, `db: ${compact.slice(0, 800)}`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
