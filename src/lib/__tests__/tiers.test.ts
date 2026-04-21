import { describe, it, expect } from 'vitest'
import {
  TIER_LIMITS,
  TIER_PRICES,
  TIER_FEATURES,
  TIER_NEGATIVES,
  COMPARISON_FEATURES,
} from '@/lib/tiers'

// ─── TIER_LIMITS ────────────────────────────────────────────────────────────

describe('TIER_LIMITS', () => {
  describe('FREE tier', () => {
    const free = TIER_LIMITS.FREE

    it('has correct player and round limits', () => {
      expect(free.maxPlayers).toBe(16)
      expect(free.maxRounds).toBe(1)
    })

    it('restricts pro features', () => {
      expect(free.powerups).toBe(false)
      expect(free.customBranding).toBe(false)
      expect(free.gallery).toBe(false)
      expect(free.gps).toBe(false)
      expect(free.insights).toBe(false)
      expect(free.colorSelection).toBe(false)
      expect(free.flights).toBe(false)
      expect(free.exportResults).toBe(false)
    })

    it('limits to 1 tournament per month', () => {
      expect(free.maxTournamentsPerMonth).toBe(1)
    })
  })

  describe('PRO tier', () => {
    const pro = TIER_LIMITS.PRO

    it('has correct player and round limits', () => {
      expect(pro.maxPlayers).toBe(72)
      expect(pro.maxRounds).toBe(4)
    })

    it('enables all pro features', () => {
      expect(pro.powerups).toBe(true)
      expect(pro.customBranding).toBe(true)
      expect(pro.gallery).toBe(true)
      expect(pro.gps).toBe(true)
      expect(pro.insights).toBe(true)
      expect(pro.colorSelection).toBe(true)
      expect(pro.flights).toBe(true)
      expect(pro.exportResults).toBe(true)
    })

    it('has unlimited tournaments per month', () => {
      expect(pro.maxTournamentsPerMonth).toBe(Infinity)
    })
  })

  describe('CLUB tier', () => {
    const club = TIER_LIMITS.CLUB

    it('matches PRO limits for players and rounds', () => {
      expect(club.maxPlayers).toBe(TIER_LIMITS.PRO.maxPlayers)
      expect(club.maxRounds).toBe(TIER_LIMITS.PRO.maxRounds)
    })

    it('limits to 4 tournaments per month', () => {
      expect(club.maxTournamentsPerMonth).toBe(4)
    })

    it('enables all pro features', () => {
      expect(club.powerups).toBe(true)
      expect(club.customBranding).toBe(true)
    })
  })

  describe('LEAGUE tier', () => {
    const league = TIER_LIMITS.LEAGUE

    it('has highest player and round limits', () => {
      expect(league.maxPlayers).toBe(144)
      expect(league.maxRounds).toBe(99)
    })

    it('has unlimited tournaments per month', () => {
      expect(league.maxTournamentsPerMonth).toBe(Infinity)
    })

    it('enables all features', () => {
      const allFeatures: (keyof typeof league)[] = [
        'powerups', 'customBranding', 'flights', 'exportResults',
        'gallery', 'gps', 'insights', 'colorSelection',
      ]
      for (const feature of allFeatures) {
        expect(league[feature]).toBe(true)
      }
    })
  })

  describe('tier hierarchy', () => {
    it('maxPlayers increases with tier level', () => {
      expect(TIER_LIMITS.FREE.maxPlayers).toBeLessThan(TIER_LIMITS.PRO.maxPlayers)
      expect(TIER_LIMITS.PRO.maxPlayers).toBeLessThanOrEqual(TIER_LIMITS.LEAGUE.maxPlayers)
    })

    it('maxRounds increases with tier level', () => {
      expect(TIER_LIMITS.FREE.maxRounds).toBeLessThan(TIER_LIMITS.PRO.maxRounds)
      expect(TIER_LIMITS.PRO.maxRounds).toBeLessThanOrEqual(TIER_LIMITS.LEAGUE.maxRounds)
    })
  })
})

// ─── TIER_PRICES ────────────────────────────────────────────────────────────

describe('TIER_PRICES', () => {
  it('PRO is $29 per tournament', () => {
    expect(TIER_PRICES.PRO.amount).toBe(2900)
    expect(TIER_PRICES.PRO.label).toBe('$29')
  })

  it('CLUB is $99/month', () => {
    expect(TIER_PRICES.CLUB.amount).toBe(9900)
    expect(TIER_PRICES.CLUB.label).toBe('$99')
  })

  it('LEAGUE is $1,499/year', () => {
    expect(TIER_PRICES.LEAGUE_SEASON.amount).toBe(149900)
    expect(TIER_PRICES.LEAGUE_SEASON.label).toBe('$1,499')
  })

  it('prices are in cents (Stripe format)', () => {
    expect(TIER_PRICES.PRO.amount).toBeGreaterThan(100) // not dollars
    expect(TIER_PRICES.CLUB.amount).toBeGreaterThan(100)
    expect(TIER_PRICES.LEAGUE_SEASON.amount).toBeGreaterThan(100)
  })
})

// ─── TIER_FEATURES ──────────────────────────────────────────────────────────

describe('TIER_FEATURES', () => {
  it('all tiers have feature lists', () => {
    expect(TIER_FEATURES.FREE.length).toBeGreaterThan(0)
    expect(TIER_FEATURES.PRO.length).toBeGreaterThan(0)
    expect(TIER_FEATURES.CLUB.length).toBeGreaterThan(0)
    expect(TIER_FEATURES.LEAGUE.length).toBeGreaterThan(0)
  })

  it('FREE tier mentions player limit', () => {
    expect(TIER_FEATURES.FREE.some(f => f.includes('16'))).toBe(true)
  })

  it('PRO tier mentions powerups', () => {
    expect(TIER_FEATURES.PRO.some(f => f.toLowerCase().includes('powerup'))).toBe(true)
  })
})

// ─── TIER_NEGATIVES ─────────────────────────────────────────────────────────

describe('TIER_NEGATIVES', () => {
  it('FREE has the most restrictions', () => {
    expect(TIER_NEGATIVES.FREE.length).toBeGreaterThan(TIER_NEGATIVES.PRO.length)
    expect(TIER_NEGATIVES.PRO.length).toBeGreaterThan(TIER_NEGATIVES.CLUB.length)
  })

  it('LEAGUE has no negatives', () => {
    expect(TIER_NEGATIVES.LEAGUE).toHaveLength(0)
  })
})

// ─── COMPARISON_FEATURES ────────────────────────────────────────────────────

describe('COMPARISON_FEATURES', () => {
  it('has feature rows', () => {
    expect(COMPARISON_FEATURES.length).toBeGreaterThan(10)
  })

  it('FREE lacks powerups and branding', () => {
    const powerups = COMPARISON_FEATURES.find(f => f.label.includes('Powerups'))
    const branding = COMPARISON_FEATURES.find(f => f.label.includes('branding'))
    expect(powerups?.free).toBe(false)
    expect(branding?.free).toBe(false)
  })

  it('PRO+ has powerups and branding', () => {
    const powerups = COMPARISON_FEATURES.find(f => f.label.includes('Powerups'))
    const branding = COMPARISON_FEATURES.find(f => f.label.includes('branding'))
    expect(powerups?.pro).toBe(true)
    expect(powerups?.club).toBe(true)
    expect(powerups?.tour).toBe(true)
    expect(branding?.pro).toBe(true)
  })

  it('all tiers have real-time leaderboard', () => {
    const leaderboard = COMPARISON_FEATURES.find(f => f.label.includes('leaderboard'))
    expect(leaderboard?.free).toBe(true)
    expect(leaderboard?.pro).toBe(true)
    expect(leaderboard?.club).toBe(true)
    expect(leaderboard?.tour).toBe(true)
  })

  it('season standings only for CLUB and TOUR', () => {
    const season = COMPARISON_FEATURES.find(f => f.label.includes('Season'))
    expect(season?.free).toBe(false)
    expect(season?.pro).toBe(false)
    expect(season?.club).toBe(true)
    expect(season?.tour).toBe(true)
  })
})
