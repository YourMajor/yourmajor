import { describe, it, expect } from 'vitest'
import { validateSubdomain, extractLeagueSubdomain } from '@/lib/subdomain'

describe('validateSubdomain', () => {
  it('accepts a clean subdomain', () => {
    const result = validateSubdomain('myleague')
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.normalized).toBe('myleague')
  })

  it('lowercases and trims input', () => {
    const result = validateSubdomain('  MyLeague  ')
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.normalized).toBe('myleague')
  })

  it('allows hyphens in the middle', () => {
    expect(validateSubdomain('my-league').valid).toBe(true)
    expect(validateSubdomain('my-cool-league-2026').valid).toBe(true)
  })

  it('rejects empty input', () => {
    const result = validateSubdomain('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/required/i)
  })

  it('rejects too short (< 3 chars)', () => {
    const result = validateSubdomain('ab')
    expect(result.valid).toBe(false)
  })

  it('rejects too long (> 63 chars)', () => {
    const result = validateSubdomain('a'.repeat(64))
    expect(result.valid).toBe(false)
  })

  it('rejects leading/trailing hyphens', () => {
    expect(validateSubdomain('-foo').valid).toBe(false)
    expect(validateSubdomain('foo-').valid).toBe(false)
  })

  it('rejects consecutive hyphens', () => {
    expect(validateSubdomain('foo--bar').valid).toBe(false)
  })

  it('rejects uppercase and special characters', () => {
    expect(validateSubdomain('MyLeague!').valid).toBe(false)
    expect(validateSubdomain('foo bar').valid).toBe(false)
    expect(validateSubdomain('foo.bar').valid).toBe(false)
  })

  it('rejects reserved words', () => {
    expect(validateSubdomain('www').valid).toBe(false)
    expect(validateSubdomain('api').valid).toBe(false)
    expect(validateSubdomain('admin').valid).toBe(false)
    expect(validateSubdomain('app').valid).toBe(false)
    expect(validateSubdomain('billing').valid).toBe(false)
    expect(validateSubdomain('team').valid).toBe(false)
    expect(validateSubdomain('tour').valid).toBe(false)
  })
})

describe('extractLeagueSubdomain', () => {
  it('extracts a league subdomain from the production host', () => {
    expect(extractLeagueSubdomain('myleague.yourmajor.app', 'yourmajor.app')).toBe('myleague')
  })

  it('returns null for the apex domain', () => {
    expect(extractLeagueSubdomain('yourmajor.app', 'yourmajor.app')).toBeNull()
  })

  it('returns null for www', () => {
    expect(extractLeagueSubdomain('www.yourmajor.app', 'yourmajor.app')).toBeNull()
  })

  it('returns null for reserved subdomains', () => {
    expect(extractLeagueSubdomain('api.yourmajor.app', 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain('admin.yourmajor.app', 'yourmajor.app')).toBeNull()
  })

  it('returns null for hosts not under the root domain', () => {
    expect(extractLeagueSubdomain('example.com', 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain('myleague.different.com', 'yourmajor.app')).toBeNull()
  })

  it('returns null for multi-level subdomains', () => {
    expect(extractLeagueSubdomain('a.b.yourmajor.app', 'yourmajor.app')).toBeNull()
  })

  it('strips port numbers from the host', () => {
    expect(extractLeagueSubdomain('myleague.yourmajor.app:3000', 'yourmajor.app')).toBe('myleague')
  })

  it('is case insensitive on the host', () => {
    expect(extractLeagueSubdomain('MyLeague.YourMajor.App', 'yourmajor.app')).toBe('myleague')
  })

  // Labels that validateSubdomain rejects can never have been stored on a
  // tournament (updateLeagueSubdomain is the only writer and persists only
  // normalized values), so they could never resolve to a league. Rejecting
  // them here keeps them out of the middleware's cache and off the database.
  it('returns null for labels that could never be a stored subdomain', () => {
    expect(extractLeagueSubdomain('ab.yourmajor.app', 'yourmajor.app')).toBeNull() // too short
    expect(extractLeagueSubdomain(`${'a'.repeat(64)}.yourmajor.app`, 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain('-foo.yourmajor.app', 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain('foo-.yourmajor.app', 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain('foo--bar.yourmajor.app', 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain('foo_bar.yourmajor.app', 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain('foo bar.yourmajor.app', 'yourmajor.app')).toBeNull()
  })

  // The label is returned raw, never validateSubdomain's normalized form.
  // normalized is trimmed, so returning it would let a Host padded with
  // whitespace that survives header normalization (U+00A0) resolve to a
  // league it doesn't own.
  it('does not let padding trim its way into a real league', () => {
    // U+00A0 is trimmed by String.prototype.trim() but survives Host header
    // normalization, so returning the trimmed form would resolve it to a league.
    expect(extractLeagueSubdomain('\u00a0myleague.yourmajor.app', 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain('myleague\u00a0.yourmajor.app', 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain(' myleague.yourmajor.app', 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain('myleague .yourmajor.app', 'yourmajor.app')).toBeNull()
    expect(extractLeagueSubdomain('\tmyleague.yourmajor.app', 'yourmajor.app')).toBeNull()
  })

  it('still returns every label that a league can actually own', () => {
    // Round-trip: anything updateLeagueSubdomain would store must still resolve.
    for (const stored of ['myleague', 'my-league', 'my-cool-league-2026', 'abc', 'a'.repeat(63)]) {
      const validation = validateSubdomain(stored)
      expect(validation.valid).toBe(true)
      expect(extractLeagueSubdomain(`${stored}.yourmajor.app`, 'yourmajor.app')).toBe(stored)
    }
  })
})
