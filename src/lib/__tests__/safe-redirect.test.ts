import { describe, it, expect } from 'vitest'
import { safeNextPath } from '@/lib/safe-redirect'

describe('safeNextPath', () => {
  it('passes through a same-origin path', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard')
    expect(safeNextPath('/my-league/draft?tab=board')).toBe('/my-league/draft?tab=board')
  })

  it('falls back when next is absent', () => {
    expect(safeNextPath(null)).toBe('/dashboard')
    expect(safeNextPath(undefined)).toBe('/dashboard')
    expect(safeNextPath('')).toBe('/dashboard')
  })

  it('honours a custom fallback', () => {
    expect(safeNextPath(null, '/auth/reset-password')).toBe('/auth/reset-password')
    expect(safeNextPath('https://evil.com', '')).toBe('')
  })

  it('rejects protocol-relative URLs', () => {
    expect(safeNextPath('//evil.com')).toBe('/dashboard')
    expect(safeNextPath('//evil.com/phish')).toBe('/dashboard')
  })

  it('rejects the backslash variant browsers fold to //', () => {
    expect(safeNextPath('/\\evil.com')).toBe('/dashboard')
  })

  // The WHATWG URL parser strips ASCII tab, LF and CR before parsing, so these
  // resolve to //evil.com in the browser even though the raw string looks like
  // a single-slash path. Any raw tab/LF/CR is rejected, not stripped.
  it('rejects tab / newline / carriage return smuggled into the path', () => {
    expect(safeNextPath('/\t/evil.com')).toBe('/dashboard')
    expect(safeNextPath('/\n/evil.com')).toBe('/dashboard')
    expect(safeNextPath('/\r/evil.com')).toBe('/dashboard')
    expect(safeNextPath('/\t\\evil.com')).toBe('/dashboard')
    expect(safeNextPath('/dash\tboard')).toBe('/dashboard')
  })

  it('rejects absolute URLs', () => {
    expect(safeNextPath('https://evil.com')).toBe('/dashboard')
    expect(safeNextPath('http://evil.com')).toBe('/dashboard')
  })

  // `${origin}${next}` with next='@evil.com' produces
  // https://yourmajor.club@evil.com — host is evil.com, our domain is userinfo.
  it('rejects a userinfo-injection value', () => {
    expect(safeNextPath('@evil.com')).toBe('/dashboard')
    expect(safeNextPath('.evil.com')).toBe('/dashboard')
  })
})
