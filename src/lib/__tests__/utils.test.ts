import { describe, it, expect } from 'vitest'
import { isLightColor, brandVars } from '../utils'

describe('isLightColor', () => {
  it('detects light hex colors', () => {
    expect(isLightColor('#F5E642')).toBe(true)
    expect(isLightColor('#ffffff')).toBe(true)
  })

  it('detects dark hex colors', () => {
    expect(isLightColor('#006747')).toBe(false)
    expect(isLightColor('#1B2A4A')).toBe(false)
  })

  it('handles hex without the # prefix', () => {
    expect(isLightColor('F5E642')).toBe(true)
    expect(isLightColor('006747')).toBe(false)
  })

  it('parses rgb()', () => {
    expect(isLightColor('rgb(255, 255, 255)')).toBe(true)
    expect(isLightColor('rgb(0, 60, 40)')).toBe(false)
  })

  it('parses oklch()', () => {
    expect(isLightColor('oklch(0.9 0 0)')).toBe(true)
    expect(isLightColor('oklch(0.3 0.1 150)')).toBe(false)
  })

  it('treats unknown formats as dark', () => {
    expect(isLightColor('papayawhip')).toBe(false)
    expect(isLightColor('')).toBe(false)
  })
})

describe('brandVars', () => {
  it('returns guarded vars for both colors', () => {
    expect(brandVars('#006747', '#C9A84C')).toEqual({
      '--color-primary': '#006747',
      '--primary-foreground': 'var(--brand-bone)',
      '--color-accent': '#C9A84C',
      '--accent-foreground': 'var(--brand-ink)',
    })
  })

  it('flips the foreground for a light primary', () => {
    expect(brandVars('#F5E642', null)).toEqual({
      '--color-primary': '#F5E642',
      '--primary-foreground': 'var(--brand-ink)',
    })
  })

  it('returns an empty object when unbranded', () => {
    expect(brandVars(null, null)).toEqual({})
    expect(brandVars(undefined, undefined)).toEqual({})
  })
})
