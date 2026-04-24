import { describe, it, expect } from 'vitest'
import {
  parseTiebreakers,
  compareTiebreaker,
  compareWithTiebreakers,
  DEFAULT_TIEBREAKERS,
  dropLowestN,
  type Tiebreaker,
  type SeasonPlayerSummary,
} from '@/lib/season-tiebreakers'

function makePlayer(overrides: Partial<SeasonPlayerSummary>): SeasonPlayerSummary {
  return {
    userId: 'u',
    playerName: 'P',
    avatarUrl: null,
    eventsPlayed: 0,
    totalEvents: 0,
    value: 0,
    eventResults: [],
    trend: null,
    rank: 0,
    ...overrides,
  }
}

describe('parseTiebreakers', () => {
  it('returns DEFAULT_TIEBREAKERS for invalid input', () => {
    expect(parseTiebreakers(null)).toEqual(DEFAULT_TIEBREAKERS)
    expect(parseTiebreakers(undefined)).toEqual(DEFAULT_TIEBREAKERS)
    expect(parseTiebreakers('LOW_STROKES')).toEqual(DEFAULT_TIEBREAKERS)
    expect(parseTiebreakers([])).toEqual(DEFAULT_TIEBREAKERS)
    expect(parseTiebreakers(['NONSENSE'])).toEqual(DEFAULT_TIEBREAKERS)
  })

  it('preserves valid ordered tiebreakers', () => {
    const ordered: Tiebreaker[] = ['HEAD_TO_HEAD', 'COUNTBACK', 'BEST_FINISH']
    expect(parseTiebreakers(ordered)).toEqual(ordered)
  })

  it('strips invalid entries while keeping valid ones', () => {
    expect(parseTiebreakers(['HEAD_TO_HEAD', 'NOPE', 'COUNTBACK'])).toEqual([
      'HEAD_TO_HEAD',
      'COUNTBACK',
    ])
  })
})

describe('compareTiebreaker — BEST_FINISH', () => {
  it('player with the better single best finish ranks higher', () => {
    const a = makePlayer({
      eventResults: [
        { tournamentId: 't1', tournamentSlug: 's1', tournamentName: 'E1', date: null, rank: 3, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 80, netTotal: 80 },
        { tournamentId: 't2', tournamentSlug: 's2', tournamentName: 'E2', date: null, rank: 5, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 82, netTotal: 82 },
      ],
    })
    const b = makePlayer({
      eventResults: [
        { tournamentId: 't1', tournamentSlug: 's1', tournamentName: 'E1', date: null, rank: 1, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 75, netTotal: 75 },
        { tournamentId: 't2', tournamentSlug: 's2', tournamentName: 'E2', date: null, rank: 8, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 88, netTotal: 88 },
      ],
    })
    // b has the better best finish (1st vs 3rd) → ranks higher (negative cmp)
    expect(compareTiebreaker('BEST_FINISH', a, b)).toBeGreaterThan(0)
  })
})

describe('compareTiebreaker — LOW_STROKES', () => {
  it('player with lower total gross strokes ranks higher', () => {
    const a = makePlayer({
      eventResults: [
        { tournamentId: 't1', tournamentSlug: 's1', tournamentName: 'E1', date: null, rank: 1, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 80, netTotal: 80 },
      ],
    })
    const b = makePlayer({
      eventResults: [
        { tournamentId: 't1', tournamentSlug: 's1', tournamentName: 'E1', date: null, rank: 1, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 90, netTotal: 90 },
      ],
    })
    expect(compareTiebreaker('LOW_STROKES', a, b)).toBeLessThan(0)
  })
})

describe('compareTiebreaker — HEAD_TO_HEAD', () => {
  it('counts wins in events both played', () => {
    const a = makePlayer({
      eventResults: [
        { tournamentId: 't1', tournamentSlug: '', tournamentName: '', date: null, rank: 1, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 0, netTotal: 0 },
        { tournamentId: 't2', tournamentSlug: '', tournamentName: '', date: null, rank: 4, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 0, netTotal: 0 },
      ],
    })
    const b = makePlayer({
      eventResults: [
        { tournamentId: 't1', tournamentSlug: '', tournamentName: '', date: null, rank: 3, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 0, netTotal: 0 },
        { tournamentId: 't2', tournamentSlug: '', tournamentName: '', date: null, rank: 2, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 0, netTotal: 0 },
      ],
    })
    // a beat b in t1, b beat a in t2 — 1-1, return 0
    expect(compareTiebreaker('HEAD_TO_HEAD', a, b)).toBe(0)
  })

  it('ignores events only one player attended', () => {
    const a = makePlayer({
      eventResults: [
        { tournamentId: 't1', tournamentSlug: '', tournamentName: '', date: null, rank: 1, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 0, netTotal: 0 },
      ],
    })
    const b = makePlayer({
      eventResults: [
        { tournamentId: 't2', tournamentSlug: '', tournamentName: '', date: null, rank: 1, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: 0, netTotal: 0 },
      ],
    })
    expect(compareTiebreaker('HEAD_TO_HEAD', a, b)).toBe(0)
  })
})

describe('dropLowestN', () => {
  it('drops the lowest N (higher-is-better) and preserves order of survivors', () => {
    expect(dropLowestN([10, 5, 8, 3, 7], 2, true)).toEqual([10, 8, 7])
  })

  it('drops the highest N (lower-is-better) for stroke-style scoring', () => {
    // lower-is-better: drop the worst (highest) values.
    expect(dropLowestN([3, 8, 5, 12, 7], 2, false)).toEqual([3, 5, 7])
  })

  it('returns input unchanged when n <= 0', () => {
    expect(dropLowestN([1, 2, 3], 0, true)).toEqual([1, 2, 3])
  })

  it('returns empty when n equals length', () => {
    expect(dropLowestN([1, 2, 3], 3, true)).toEqual([])
  })
})

describe('compareWithTiebreakers', () => {
  it('returns primary when non-zero (no tiebreakers consulted)', () => {
    const a = makePlayer({})
    const b = makePlayer({})
    expect(compareWithTiebreakers(a, b, -3, ['LOW_STROKES'])).toBe(-3)
    expect(compareWithTiebreakers(a, b, 5, ['LOW_STROKES'])).toBe(5)
  })

  it('falls through tiebreaker ladder until one is decisive', () => {
    // a and b are tied on primary; tied on BEST_FINISH (both 1st);
    // LOW_STROKES decides — a is lower.
    const tiedFirst = (gross: number) => makePlayer({
      eventResults: [
        { tournamentId: 't1', tournamentSlug: '', tournamentName: '', date: null, rank: 1, grossVsPar: 0, netVsPar: 0, points: 0, grossTotal: gross, netTotal: gross },
      ],
    })
    const a = tiedFirst(80)
    const b = tiedFirst(90)
    expect(compareWithTiebreakers(a, b, 0, ['BEST_FINISH', 'LOW_STROKES'])).toBeLessThan(0)
  })
})
