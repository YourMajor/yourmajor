import { describe, it, expect, vi } from 'vitest'

// variable-powerup-evaluator imports prisma at module scope for its evaluation
// functions; the two activation helpers under test touch no database.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import {
  initialVariableMetadata,
  variableActivationDetail,
  type VariableActivationContext,
} from '@/lib/variable-powerup-evaluator'

// These shapes used to be built by a 9-branch chain inside
// api/tournaments/[id]/powerups/activate. Every object below is pinned to what
// that chain produced, so the move to the lib layer is provably behaviour
// preserving - the evaluator casts this metadata straight to its per-slug
// interfaces and would misread a renamed or missing key silently.

const ctx: VariableActivationContext = {
  holeNumber: 7,
  numberValue: 4,
  selectedPlayerIds: ['tp_a', 'tp_b'],
  targetPlayerId: null,
}

describe('initialVariableMetadata', () => {
  it('fairway-finder', () => {
    expect(initialVariableMetadata('fairway-finder', ctx)).toEqual({
      declaredCount: 4,
      activationHoleNumber: 7,
      fairwaysHit: 0,
      status: 'in_progress',
    })
  })

  it('king-of-the-hill', () => {
    expect(initialVariableMetadata('king-of-the-hill', ctx)).toEqual({
      targetPlayerIds: ['tp_a', 'tp_b'],
      activationHoleNumber: 7,
      consecutiveWins: 0,
      status: 'in_progress',
    })
  })

  it('the-streaker', () => {
    expect(initialVariableMetadata('the-streaker', ctx)).toEqual({
      declaredCount: 4,
      activationHoleNumber: 7,
      girsHit: 0,
      status: 'in_progress',
    })
  })

  it('no-three-putts', () => {
    expect(initialVariableMetadata('no-three-putts', ctx)).toEqual({
      declaredCount: 4,
      activationHoleNumber: 7,
      holesPlayed: 0,
      status: 'in_progress',
    })
  })

  it('birdie-hunter', () => {
    expect(initialVariableMetadata('birdie-hunter', ctx)).toEqual({
      activationHoleNumber: 7,
      holesScored: 0,
      bonusStrokes: 0,
      status: 'in_progress',
    })
  })

  it('stayin-alive', () => {
    expect(initialVariableMetadata('stayin-alive', ctx)).toEqual({
      activationHoleNumber: 7,
      holesScored: 0,
      hadBogey: false,
      status: 'in_progress',
    })
  })

  it('double-or-nothing prefers the single attack target over the multi-select', () => {
    expect(initialVariableMetadata('double-or-nothing', { ...ctx, targetPlayerId: 'tp_z' })).toEqual({
      targetPlayerIds: ['tp_z'],
      activationHoleNumber: 7,
      holesScored: 0,
      netDelta: 0,
      status: 'in_progress',
    })
    expect(initialVariableMetadata('double-or-nothing', ctx)).toMatchObject({
      targetPlayerIds: ['tp_a', 'tp_b'],
    })
  })

  it('one-putt-wonder', () => {
    expect(initialVariableMetadata('one-putt-wonder', ctx)).toEqual({
      activationHoleNumber: 7,
      holesScored: 0,
      bonusStrokes: 0,
      status: 'in_progress',
    })
  })

  it('foot-wedge opens with the full window, not a hardcoded 9', () => {
    expect(initialVariableMetadata('foot-wedge', ctx)).toEqual({
      activationHoleNumber: 7,
      holesRemaining: 9,
      status: 'in_progress',
    })
  })

  it('defaults declaredCount per slug when no number was submitted', () => {
    const bare = { ...ctx, numberValue: undefined }
    expect(initialVariableMetadata('fairway-finder', bare)).toMatchObject({ declaredCount: 1 })
    expect(initialVariableMetadata('the-streaker', bare)).toMatchObject({ declaredCount: 1 })
    // no-three-putts is the one card that declares 2 by default.
    expect(initialVariableMetadata('no-three-putts', bare)).toMatchObject({ declaredCount: 2 })
  })

  it('returns null for a non-variable slug so the caller keeps its own metadata', () => {
    expect(initialVariableMetadata('mulligan', ctx)).toBeNull()
    expect(initialVariableMetadata('parent-trap', ctx)).toBeNull()
  })
})

describe('variableActivationDetail', () => {
  it('quotes the declared count for the declaration cards', () => {
    expect(variableActivationDetail('fairway-finder', { declaredCount: 3 })).toBe(
      ', declaring 3 consecutive fairways',
    )
    expect(variableActivationDetail('the-streaker', { declaredCount: 3 })).toBe(
      ', declaring 3 consecutive GIRs',
    )
    expect(variableActivationDetail('no-three-putts', { declaredCount: 2 })).toBe(
      ', declaring 2 clean holes',
    )
  })

  it('falls back to ? when the count is missing', () => {
    expect(variableActivationDetail('fairway-finder', undefined)).toBe(
      ', declaring ? consecutive fairways',
    )
  })

  it('gives double-or-nothing a detail, which the route version omitted', () => {
    expect(variableActivationDetail('double-or-nothing', {})).toMatch(/counts double/i)
  })

  it('covers every variable slug', () => {
    const slugs = [
      'fairway-finder',
      'king-of-the-hill',
      'the-streaker',
      'no-three-putts',
      'birdie-hunter',
      'stayin-alive',
      'double-or-nothing',
      'one-putt-wonder',
      'foot-wedge',
    ]
    for (const slug of slugs) {
      expect(initialVariableMetadata(slug, ctx), slug).not.toBeNull()
      expect(variableActivationDetail(slug, { declaredCount: 1 }), slug).not.toBe('')
    }
  })

  it('is empty for a slug with no variable behaviour', () => {
    expect(variableActivationDetail('mulligan', {})).toBe('')
  })
})
