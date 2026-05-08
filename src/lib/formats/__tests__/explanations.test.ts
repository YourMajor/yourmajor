import { describe, it, expect } from 'vitest'
import { FORMATS } from '../registry'
import { FORMAT_EXPLANATIONS, getExplanation } from '../explanations'

describe('format explanations', () => {
  it('has an entry for every format in the registry', () => {
    const registryIds = FORMATS.map((f) => f.id).sort()
    const explanationIds = Object.keys(FORMAT_EXPLANATIONS).sort()
    expect(explanationIds).toEqual(registryIds)
  })

  it('every entry has a non-empty summary and at least one scoring rule', () => {
    for (const [id, explanation] of Object.entries(FORMAT_EXPLANATIONS)) {
      expect(explanation.summary, `${id}.summary`).toMatch(/\S/)
      expect(explanation.scoringRules.length, `${id}.scoringRules`).toBeGreaterThan(0)
      for (const rule of explanation.scoringRules) {
        expect(rule, `${id} rule`).toMatch(/\S/)
      }
    }
  })

  it('getExplanation falls back to STROKE_PLAY for unknown ids', () => {
    expect(getExplanation(undefined)).toBe(FORMAT_EXPLANATIONS.STROKE_PLAY)
    expect(getExplanation(null)).toBe(FORMAT_EXPLANATIONS.STROKE_PLAY)
    expect(getExplanation('NOT_A_FORMAT')).toBe(FORMAT_EXPLANATIONS.STROKE_PLAY)
  })

  it('getExplanation returns the matching entry for a known id', () => {
    expect(getExplanation('STABLEFORD')).toBe(FORMAT_EXPLANATIONS.STABLEFORD)
    expect(getExplanation('PEORIA')).toBe(FORMAT_EXPLANATIONS.PEORIA)
  })
})
