import { describe, it, expect } from 'vitest'
import { needsDownscale } from '../crop-image'

const MB = 1024 * 1024

describe('needsDownscale', () => {
  it('leaves small render-safe images alone', () => {
    expect(needsDownscale('image/png', 0.5 * MB)).toBe(false)
    expect(needsDownscale('image/jpeg', 1.9 * MB)).toBe(false)
    expect(needsDownscale('image/webp', 100)).toBe(false)
  })

  it('downscales large render-safe images', () => {
    expect(needsDownscale('image/jpeg', 6 * MB)).toBe(true)
    expect(needsDownscale('image/png', 12 * MB)).toBe(true)
  })

  it('never touches GIFs — re-encoding would drop the animation', () => {
    expect(needsDownscale('image/gif', 8 * MB)).toBe(false)
    expect(needsDownscale('image/gif', 0.1 * MB)).toBe(false)
  })

  it('converts formats that upload fine but render broken, at any size', () => {
    expect(needsDownscale('image/heic', 0.5 * MB)).toBe(true)
    expect(needsDownscale('image/heif', 0.5 * MB)).toBe(true)
    expect(needsDownscale('image/tiff', 0.5 * MB)).toBe(true)
    expect(needsDownscale('image/bmp', 0.5 * MB)).toBe(true)
  })
})
