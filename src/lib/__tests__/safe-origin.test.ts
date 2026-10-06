import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { safeOrigin } from '@/lib/app-url'

// Regression test for the open redirect in /api/billing/checkout and
// /api/billing/portal, which built Stripe's success / cancel / return URL
// straight from the request's Origin header. `Origin` is only meaningful on a
// browser request — a plain POST sets whatever it likes — so a paying user
// could be redirected to an attacker's host after payment.

const APEX = 'https://yourmajor.club'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'yourmajor.club')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', APEX)
  vi.stubEnv('NEXTAUTH_URL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('safeOrigin', () => {
  it('passes through the apex and a league subdomain', () => {
    expect(safeOrigin(APEX)).toBe(APEX)
    expect(safeOrigin('https://my-league.yourmajor.club')).toBe('https://my-league.yourmajor.club')
  })

  it('falls back to getAppUrl when the header is absent', () => {
    expect(safeOrigin(null)).toBe(APEX)
    expect(safeOrigin(undefined)).toBe(APEX)
    expect(safeOrigin('')).toBe(APEX)
  })

  it('rejects an unrelated host', () => {
    expect(safeOrigin('https://evil.tld')).toBe(APEX)
    expect(safeOrigin('https://evil.tld/phish')).toBe(APEX)
  })

  it('rejects a host that merely contains the root domain', () => {
    // endsWith on the bare label, without the leading dot, would approve these.
    expect(safeOrigin('https://evil.yourmajor.club.evil.tld')).toBe(APEX)
    expect(safeOrigin('https://notyourmajor.club')).toBe(APEX)
  })

  it('rejects our domain in the userinfo component', () => {
    // The real host here is evil.tld; ours is only the credentials prefix.
    expect(safeOrigin('https://yourmajor.club@evil.tld')).toBe(APEX)
  })

  it('rejects non-http(s) schemes', () => {
    // These parse fine, with an empty host, so the protocol has to be checked
    // before the host comparison.
    expect(safeOrigin('javascript:alert(1)')).toBe(APEX)
    expect(safeOrigin('data:text/html,<script>alert(1)</script>')).toBe(APEX)
    expect(safeOrigin('file:///etc/passwd')).toBe(APEX)
  })

  it('rejects plain http on a real domain but allows it on localhost', () => {
    expect(safeOrigin('http://yourmajor.club')).toBe(APEX)
    expect(safeOrigin('http://localhost:3000')).toBe('http://localhost:3000')
    expect(safeOrigin('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000')
  })

  it('rejects an unparseable header', () => {
    expect(safeOrigin('not a url')).toBe(APEX)
    expect(safeOrigin('//evil.tld')).toBe(APEX)
  })

  it('strips any path the header smuggles in', () => {
    expect(safeOrigin('https://yourmajor.club/../evil')).toBe(APEX)
  })
})
