import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { prisma } from '@/lib/prisma'
import { extractLeagueSubdomain } from '@/lib/subdomain'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourmajor.club'

// Module-level cache of subdomain → resolved-slug (or null for "no league
// here / wrong tier"). The middleware runs on every request that matches the
// `config.matcher` pattern, so an uncached Prisma lookup per request would be
// a hot path on any subdomain-routed traffic. 5-min TTL is short enough that
// admins changing a subdomain or downgrading tier see it propagate quickly,
// and long enough to absorb sustained traffic spikes.
//
// Negative results (no league, or tier doesn't grant customSubdomain) are
// cached too so a misconfigured / hostile subdomain can't hammer the DB.
type CachedResolution = { slug: string | null; expiresAt: number }
const SUBDOMAIN_CACHE_TTL_MS = 5 * 60 * 1000
const subdomainCache = new Map<string, CachedResolution>()

async function resolveSubdomainSlug(subdomain: string): Promise<string | null> {
  const cached = subdomainCache.get(subdomain)
  if (cached && cached.expiresAt > Date.now()) return cached.slug

  const league = await prisma.tournament.findUnique({
    where: { subdomain },
    select: { id: true, slug: true, isLeague: true },
  })
  let slug: string | null = null
  if (league?.isLeague) {
    const tier = await getTournamentTier(league.id)
    if (TIER_LIMITS[tier].customSubdomain) {
      slug = league.slug
    }
  }
  subdomainCache.set(subdomain, { slug, expiresAt: Date.now() + SUBDOMAIN_CACHE_TTL_MS })
  return slug
}

export async function proxy(request: NextRequest) {
  // 1. Decide whether the host's subdomain should rewrite to a canonical
  //    /[slug] path. Only Tour-tier leagues with a saved subdomain qualify.
  const host = request.headers.get('host') ?? ''
  const subdomain = extractLeagueSubdomain(host, ROOT_DOMAIN)

  let rewriteUrl: URL | null = null
  if (subdomain) {
    const slug = await resolveSubdomainSlug(subdomain)
    if (slug) {
      rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = `/${slug}${rewriteUrl.pathname === '/' ? '' : rewriteUrl.pathname}`
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
