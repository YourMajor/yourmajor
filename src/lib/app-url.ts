// Resolves the public base URL used in outbound emails, SMS, and any other
// links that leave the app. Order: explicit NEXT_PUBLIC_APP_URL → NEXTAUTH_URL
// (already configured in production) → hardcoded production domain.
// trim() guards against trailing whitespace/newlines that piped CLI tools
// can accidentally bake into env var values.
export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://yourmajor.club'
  return url.trim()
}

/**
 * Constrain a request's `Origin` header to this app's own domains.
 *
 * Stripe's success / cancel / return URLs are built from it, so echoing the raw
 * header hands any caller a post-payment redirect onto their own host: `Origin`
 * is only meaningful on a browser request, and a plain POST sets whatever it
 * likes. Tour-tier leagues really do live on custom subdomains (see proxy.ts),
 * so the allowlist has to admit `*.<root>` rather than pinning the apex.
 *
 * Returns the *parsed* origin, never the caller's string. Normalising is what
 * kills the cases a string compare would wave through:
 *
 *   - `https://yourmajor.club@evil.tld` — our domain is only the userinfo
 *     component here; the real host is evil.tld
 *   - `https://evil.yourmajor.club.evil.tld` — endsWith on the bare label
 *     without the leading dot would approve it
 *   - `javascript:alert(1)` — parses fine, with an empty host, so the protocol
 *     has to be checked before the host
 */
export function safeOrigin(origin: string | null | undefined): string {
  const fallback = getAppUrl()
  if (!origin) return fallback

  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return fallback
  }

  const host = url.hostname.toLowerCase()
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) return fallback
  if (isLocal) return url.origin

  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourmajor.club').toLowerCase()
  if (host !== root && !host.endsWith(`.${root}`)) return fallback

  return url.origin
}
