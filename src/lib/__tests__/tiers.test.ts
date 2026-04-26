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
      expect(free.maxPhotos).toBe(0)
      expect(free.gps).toBe(false)
      expect(free.insights).toBe(false)
      expect(free.colorSelection).toBe(false)
      expect(free.flights).toBe(false)
      expect(free.exportResults).toBe(false)
      expect(free.sponsorPlacements).toBe(false)
      expect(free.seasonOverSeasonTracking).toBe(false)
      expect(free.customSubdomain).toBe(false)
      expect(free.prioritySupport).toBe(false)
    })

    it('allows unlimited tournaments per month', () => {
      expect(free.maxTournamentsPerMonth).toBe(Infinity)
    })

    it('has a single admin seat', () => {
      expect(free.maxAdminSeats).toBe(1)
    })
  })

  describe('PRO tier', () => {
    const pro = TIER_LIMITS.PRO

    it('has correct player and round limits', () => {
      expect(pro.maxPlayers).toBe(72)
      expect(pro.maxRounds).toBe(2)
    })

    it('enables all pro features', () => {
      expect(pro.powerups).toBe(true)
      expect(pro.customBranding).toBe(true)
      expect(pro.maxPhotos).toBe(100)
      expect(pro.gps).toBe(true)
      expect(pro.insights).toBe(true)
      expect(pro.colorSelection).toBe(true)
      expect(pro.flights).toBe(true)
      expect(pro.exportResults).toBe(true)
    })

    it('does not include club/tour exclusives', () => {
      expect(pro.sponsorPlacements).toBe(false)
      expect(pro.seasonOverSeasonTracking).toBe(false)
      expect(pro.customSubdomain).toBe(false)
      expect(pro.maxAdminSeats).toBe(1)
    })

    it('has unlimited tournaments per month', () => {
      expect(pro.maxTournamentsPerMonth).toBe(Infinity)
    })
  })

  describe('CLUB tier', () => {
    const club = TIER_LIMITS.CLUB

    it('matches PRO player limit and allows up to 4 rounds', () => {
      expect(club.maxPlayers).toBe(TIER_LIMITS.PRO.maxPlayers)
      expect(club.maxRounds).toBe(4)
    })

    it('limits to 4 tournaments per month', () => {
      expect(club.maxTournamentsPerMonth).toBe(4)
    })

    it('enables all pro features plus club extras', () => {
      expect(club.powerups).toBe(true)
      expect(club.customBranding).toBe(true)
      expect(club.maxPhotos).toBe(250)
      expect(club.sponsorPlacements).toBe(true)
      expect(club.seasonOverSeasonTracking).toBe(true)
      expect(club.maxAdminSeats).toBe(2)
    })

    it('does not include tour exclusives', () => {
      expect(club.customSubdomain).toBe(false)
      expect(club.prioritySupport).toBe(false)
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

    it('enables all boolean features', () => {
      const allBooleanFeatures: (keyof typeof league)[] = [
        'powerups', 'customBranding', 'flights', 'exportResults',
        'gps', 'insights', 'colorSelection',
        'sponsorPlacements', 'seasonOverSeasonTracking', 'customSubdomain', 'prioritySupport',
      ]
      for (const feature of allBooleanFeatures) {
        expect(league[feature]).toBe(true)
      }
    })

    it('grants 5 admin seats and 1,000 photos', () => {
      expect(league.maxAdminSeats).toBe(5)
      expect(league.maxPhotos).toBe(1000)
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

    it('maxPhotos increases with tier level', () => {
      expect(TIER_LIMITS.FREE.maxPhotos).toBeLessThan(TIER_LIMITS.PRO.maxPhotos)
      expect(TIER_LIMITS.PRO.maxPhotos).toBeLessThan(TIER_LIMITS.CLUB.maxPhotos)
      expect(TIER_LIMITS.CLUB.maxPhotos).toBeLessThan(TIER_LIMITS.LEAGUE.maxPhotos)
    })

    it('maxAdminSeats increases at Club and Tour', () => {
      expect(TIER_LIMITS.PRO.maxAdminSeats).toBeLessThan(TIER_LIMITS.CLUB.maxAdminSeats)
      expect(TIER_LIMITS.CLUB.maxAdminSeats).toBeLessThan(TIER_LIMITS.LEAGUE.maxAdminSeats)
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

  it('LEAGUE is $1,999/year', () => {
    expect(TIER_PRICES.LEAGUE_SEASON.amount).toBe(199900)
    expect(TIER_PRICES.LEAGUE_SEASON.label).toBe('$1,999')
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

  it('CLUB tier highlights sponsor placements', () => {
    expect(TIER_FEATURES.CLUB.some(f => f.toLowerCase().includes('sponsor'))).toBe(true)
  })

  it('LEAGUE tier highlights custom subdomain', () => {
    expect(TIER_FEATURES.LEAGUE.some(f => f.toLowerCase().includes('subdomain'))).toBe(true)
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

  it('Season-long standings only for CLUB and TOUR', () => {
    const season = COMPARISON_FEATURES.find(f => f.label === 'Season-long standings')
    expect(season?.free).toBe(false)
    expect(season?.pro).toBe(false)
    expect(season?.club).toBe(true)
    expect(season?.tour).toBe(true)
  })

  it('Sponsor placements only for CLUB and TOUR', () => {
    const sponsor = COMPARISON_FEATURES.find(f => f.label === 'Sponsor placements')
    expect(sponsor?.free).toBe(false)
    expect(sponsor?.pro).toBe(false)
    expect(sponsor?.club).toBe(true)
    expect(sponsor?.tour).toBe(true)
  })

  it('Custom subdomain only for TOUR', () => {
    const subdomain = COMPARISON_FEATURES.find(f => f.label === 'Custom subdomain')
    expect(subdomain?.free).toBe(false)
    expect(subdomain?.pro).toBe(false)
    expect(subdomain?.club).toBe(false)
    expect(subdomain?.tour).toBe(true)
  })
})
