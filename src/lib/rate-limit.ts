import { prisma } from '@/lib/prisma'

export type RateLimitResult = {
  ok: boolean
  /** Requests remaining in the current window (0 once blocked). */
  remaining: number
  /** Seconds until the window resets — sent as the Retry-After header. */
  retryAfter: number
}

/**
 * Named limits, so the numbers live in one place instead of being scattered
 * across route handlers. Windows are in seconds.
 *
 * Sizing rationale: these are abuse ceilings, not usage quotas. Each is set
 * well above what a real person does and well below what makes the attack
 * worth running.
 */
export const LIMITS = {
  /** Unauthenticated, and sends a paid Resend email per call. */
  feedback: { limit: 5, windowSeconds: 3600 },
  /** Join-code lookup. 6 chars over a 32-char alphabet, so brute force is the
   *  threat; 20/10min makes a full sweep take millennia per IP. */
  joinCodeLookup: { limit: 20, windowSeconds: 600 },
  /** Fires a real Twilio SMS and/or Resend email per call. */
  inviteResend: { limit: 10, windowSeconds: 3600 },
  /** Credential stuffing. Supabase throttles too; this is defence in depth. */
  auth: { limit: 10, windowSeconds: 900 },
} as const

/**
 * Fixed-window counter keyed by an arbitrary string.
 *
 * ponytail: fixed window, two queries, and a benign race at the window
 * boundary (a request can slip through while another is resetting the row).
 * That is the right trade for abuse prevention — it is not a billing counter.
 * Upgrade to a sliding window in Redis only if request volume makes the two
 * round trips or the boundary slack actually matter.
 */
export async function checkRateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const now = new Date()

  try {
    // Clear this key's window if it has already elapsed, so the upsert below
    // starts a fresh count rather than incrementing a stale one.
    await prisma.rateLimit.deleteMany({ where: { key, expiresAt: { lte: now } } })

    const expiresAt = new Date(now.getTime() + windowSeconds * 1000)
    const row = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      // increment is atomic in Postgres, so concurrent requests can't both
      // read the same count and write back the same value.
      update: { count: { increment: 1 } },
    })

    // Sweep expired rows roughly 1% of the time. Without this, keys that are
    // hit once and never again (rotating attacker IPs) accumulate forever —
    // storage growth is itself a slow denial-of-service. Cheap enough at 1%
    // that it needs no cron of its own.
    if (Math.random() < 0.01) {
      await prisma.rateLimit.deleteMany({ where: { expiresAt: { lte: now } } })
    }

    const retryAfter = Math.max(1, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000))
    return {
      ok: row.count <= limit,
      remaining: Math.max(0, limit - row.count),
      retryAfter,
    }
  } catch (err) {
    // Fail open. A rate limiter that takes the whole feature down when the
    // database hiccups is a worse outage than the abuse it prevents — and
    // every caller here already has its own auth/validation in front of it.
    console.error('[rate-limit] check failed, allowing request:', err)
    return { ok: true, remaining: limit, retryAfter: 0 }
  }
}

/**
 * Best-effort client IP. On Vercel the platform sets x-forwarded-for and
 * strips any client-supplied copy, so the first entry is the real peer.
 * Falls back to a shared bucket rather than to a per-request unique value:
 * an unknown IP should share a limit, not get an unlimited one each time.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Same check, for server actions — they have no NextRequest, so the headers
 * come from next/headers instead. Returns the result rather than throwing so
 * each action can fail in whatever way its page already expects.
 */
export async function checkRateLimitByIp(
  prefix: string,
  opts: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const { headers } = await import('next/headers')
  return checkRateLimit(`${prefix}:${clientIp(await headers())}`, opts)
}

/** 429 response with the Retry-After header clients and crawlers expect. */
export function rateLimitedResponse(retryAfter: number, message = 'Too many requests. Please try again later.') {
  return Response.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
