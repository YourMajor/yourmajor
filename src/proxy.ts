import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { prisma } from '@/lib/prisma'
import { extractLeagueSubdomain } from '@/lib/subdomain'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourmajor.app'

export async function proxy(request: NextRequest) {
  // 1. Decide whether the host's subdomain should rewrite to a canonical
  //    /[slug] path. Only Tour-tier leagues with a saved subdomain qualify.
  const host = request.headers.get('host') ?? ''
  const subdomain = extractLeagueSubdomain(host, ROOT_DOMAIN)

  let rewriteUrl: URL | null = null
  if (subdomain) {
    const league = await prisma.tournament.findUnique({
      where: { subdomain },
      select: { id: true, slug: true, isLeague: true },
    })
    if (league?.isLeague) {
      const tier = await getTournamentTier(league.id)
      if (TIER_LIMITS[tier].customSubdomain) {
        rewriteUrl = request.nextUrl.clone()
        rewriteUrl.pathname = `/${league.slug}${rewriteUrl.pathname === '/' ? '' : rewriteUrl.pathname}`
      }
    }
  }

  // 2. Always run Supabase session refresh so auth cookies stay current.
  const sessionResponse = await updateSession(request)

  // 3. If the subdomain mapped to a real league, rewrite to the canonical
  //    path while preserving the cookies the session update wrote.
  if (rewriteUrl) {
    const rewrite = NextResponse.rewrite(rewriteUrl)
    for (const c of sessionResponse.cookies.getAll()) {
      rewrite.cookies.set(c.name, c.value)
    }
    return rewrite
  }

  return sessionResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
