import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildCsp } from '@/lib/csp'

const SUPABASE = 'https://wwwqjfjqexample.supabase.co'

function directive(csp: string, name: string): string {
  const found = csp.split('; ').find((d) => d.startsWith(`${name} `))
  return found ?? ''
}

describe('buildCsp', () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = `${SUPABASE}/`
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = original
  })

  it('carries the nonce and strict-dynamic in script-src', () => {
    const csp = buildCsp('abc-123', false)
    expect(directive(csp, 'script-src')).toContain("'nonce-abc-123'")
    expect(directive(csp, 'script-src')).toContain("'strict-dynamic'")
  })

  // A nonce in script-src is the whole point; 'unsafe-inline' there would make
  // it decorative, since browsers honour the nonce and ignore unsafe-inline.
  it('never allows unsafe-inline scripts, in either mode', () => {
    expect(directive(buildCsp('n', false), 'script-src')).not.toContain("'unsafe-inline'")
    expect(directive(buildCsp('n', true), 'script-src')).not.toContain("'unsafe-inline'")
  })

  // React renders style={{...}} as an inline style attribute. A nonce on
  // style-src makes the browser ignore 'unsafe-inline' and the app renders
  // unstyled — so the nonce must stay off this directive specifically.
  it('allows inline styles but puts no nonce on style-src', () => {
    const styleSrc = directive(buildCsp('abc-123', false), 'style-src')
    expect(styleSrc).toContain("'unsafe-inline'")
    expect(styleSrc).not.toContain('nonce')
  })

  it("keeps 'unsafe-eval' to dev, where React needs it for server stacks", () => {
    expect(directive(buildCsp('n', true), 'script-src')).toContain("'unsafe-eval'")
    expect(directive(buildCsp('n', false), 'script-src')).not.toContain("'unsafe-eval'")
  })

  it('reaches Supabase over both https and the realtime socket', () => {
    const connect = directive(buildCsp('n', false), 'connect-src')
    expect(connect).toContain(SUPABASE)
    expect(connect).toContain(`wss://${new URL(SUPABASE).host}`)
  })

  it('lets unoptimized <Image> load straight from Supabase Storage', () => {
    expect(directive(buildCsp('n', false), 'img-src')).toContain(SUPABASE)
  })

  // Build-time contexts (Preview env collection) run with no Supabase URL set.
  // The policy must still be a valid header rather than one containing "null".
  it('emits a clean policy when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const csp = buildCsp('n', false)
    expect(csp).not.toContain('null')
    expect(csp).not.toContain('false')
    expect(csp).not.toMatch(/;\s*;/)
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self'")
  })

  it('locks down the directives that have no legitimate use here', () => {
    const csp = buildCsp('n', false)
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).toContain('upgrade-insecure-requests')
  })
})
