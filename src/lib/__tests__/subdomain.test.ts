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
})
