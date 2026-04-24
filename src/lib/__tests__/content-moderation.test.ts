import { describe, it, expect } from 'vitest'
import { containsProfanity, ProfanityError } from '@/lib/content-moderation'

describe('containsProfanity', () => {
  it('returns false for clean tournament names', () => {
    expect(containsProfanity('Club Champs 2026')).toBe(false)
    expect(containsProfanity('Wednesday Night League')).toBe(false)
    expect(containsProfanity('The Masters Weekend')).toBe(false)
  })

  it('returns false for empty, null, or undefined input', () => {
    expect(containsProfanity('')).toBe(false)
    expect(containsProfanity('   ')).toBe(false)
    expect(containsProfanity(null)).toBe(false)
    expect(containsProfanity(undefined)).toBe(false)
  })

  it('flags obvious profanity', () => {
    expect(containsProfanity('what the fuck')).toBe(true)
    expect(containsProfanity('shit show open')).toBe(true)
  })

  it('flags leetspeak and obfuscated variants', () => {
    expect(containsProfanity('f*ck this hole')).toBe(true)
    expect(containsProfanity('sh1t')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(containsProfanity('FUCK')).toBe(true)
    expect(containsProfanity('Shit')).toBe(true)
  })
})

describe('ProfanityError', () => {
  it('carries the field name and a user-facing message', () => {
    const err = new ProfanityError('Tournament name')
    expect(err.name).toBe('ProfanityError')
    expect(err.field).toBe('Tournament name')
    expect(err.message).toContain('Tournament name')
    expect(err.message).toContain('inappropriate language')
  })

  it('is an instance of Error', () => {
    expect(new ProfanityError('x')).toBeInstanceOf(Error)
  })
})
