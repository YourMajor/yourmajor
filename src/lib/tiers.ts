import type { PricingTier } from '@/generated/prisma/client'

export type TierLimits = {
  maxPlayers: number
  maxRounds: number
  powerups: boolean
  customBranding: boolean
  flights: boolean
  exportResults: boolean
  maxPhotos: number
  gps: boolean
  insights: boolean
  colorSelection: boolean
  maxTournamentsPerMonth: number
  maxAdminSeats: number
  sponsorPlacements: boolean
  seasonOverSeasonTracking: boolean
  customSubdomain: boolean
  prioritySupport: boolean
}

export const TIER_LIMITS: Record<PricingTier, TierLimits> = {
  FREE: {
    maxPlayers: 16,
    maxRounds: 1,
    powerups: false,
    customBranding: false,
    flights: false,
    exportResults: false,
    maxPhotos: 0,
    gps: false,
    insights: false,
    colorSelection: false,
    maxTournamentsPerMonth: Infinity,
    maxAdminSeats: 1,
    sponsorPlacements: false,
    seasonOverSeasonTracking: false,
    customSubdomain: false,
    prioritySupport: false,
  },
  PRO: {
    maxPlayers: 72,
    maxRounds: 2,
    powerups: true,
    customBranding: true,
    flights: true,
    exportResults: true,
    maxPhotos: 100,
    gps: true,
    insights: true,
    colorSelection: true,
    maxTournamentsPerMonth: Infinity,
    maxAdminSeats: 1,
    sponsorPlacements: false,
    seasonOverSeasonTracking: false,
    customSubdomain: false,
    prioritySupport: false,
  },
  CLUB: {
    maxPlayers: 72,
    maxRounds: 4,
    powerups: true,
    customBranding: true,
    flights: true,
    exportResults: true,
    maxPhotos: 250,
    gps: true,
    insights: true,
    colorSelection: true,
    maxTournamentsPerMonth: 4,
    maxAdminSeats: 2,
    sponsorPlacements: true,
    seasonOverSeasonTracking: true,
    customSubdomain: false,
    prioritySupport: false,
  },
  LEAGUE: {
    maxPlayers: 144,
    maxRounds: 99,
    powerups: true,
    customBranding: true,
    flights: true,
    exportResults: true,
    maxPhotos: 1000,
    gps: true,
    insights: true,
    colorSelection: true,
    maxTournamentsPerMonth: Infinity,
    maxAdminSeats: 5,
    sponsorPlacements: true,
    seasonOverSeasonTracking: true,
    customSubdomain: true,
    prioritySupport: true,
  },
}

export const TIER_PRICES = {
  PRO: { amount: 2900, label: '$29', description: 'per tournament' },
  CLUB: { amount: 9900, label: '$99', description: '/month' },
  LEAGUE_SEASON: { amount: 199900, label: '$1,999', description: '/year' },
} as const

/** Features list for each tier — used by pricing page */
export const TIER_FEATURES: Record<PricingTier, string[]> = {
  FREE: [
    'Up to 16 players',
    '1 round per tournament',
    'Real-time leaderboard',
    'Tournament chat',
    'Gross scoring only',
    'Shareable tournament link',
  ],
  PRO: [
    'Up to 72 players & 2 rounds',
    'Powerups unlocked',
    'Custom branding (logo & colors)',
    'Player flight management',
    'Photo gallery (up to 100)',
    'GPS & yardages',
    'Full stats & insights',
  ],
  CLUB: [
    '4 tournaments per month',
    'All Pro features included',
    'Photo gallery (up to 250)',
    'Season-long standings & stats',
    'Recurring player roster',
    'Sponsor placements',
    'Season-over-season player tracking',
    '2 admin seats',
    'Cancel anytime',
  ],
  LEAGUE: [
    'Unlimited events per year',
    'Up to 144 players per event',
    'All Club features included',
    'Photo gallery (up to 1,000)',
    '5 admin seats',
    'Custom subdomain (yourcrew.yourmajor.app)',
    'Priority email support',
  ],
}

/** What each tier does NOT include — shown on pricing page */
export const TIER_NEGATIVES: Record<PricingTier, string[]> = {
  FREE: [
    'Gross scoring only — no handicap systems',
    'No powerups or draft',
    'No custom branding',
    'No GPS/yardages',
    'No photo gallery',
    'Limited stats — no insights',
  ],
  PRO: [
    'No season-long standings',
    'No recurring player roster',
    'No sponsor placements',
    'Per-tournament purchase',
  ],
  CLUB: [
    'Max 4 tournaments per month',
    'No custom subdomain',
  ],
  LEAGUE: [],
}

/** Feature comparison rows for the pricing table */
export const COMPARISON_FEATURES: Array<{
  label: string
  free: string | boolean
  pro: string | boolean
  club: string | boolean
  tour: string | boolean
}> = [
  { label: 'Players per tournament', free: 'Up to 16', pro: 'Up to 72', club: 'Up to 72', tour: 'Up to 144' },
  { label: 'Rounds per tournament', free: '1', pro: 'Up to 2', club: 'Up to 4', tour: 'Unlimited' },
  { label: 'Tournaments per month', free: 'Unlimited', pro: 'Per credit', club: 'Up to 4', tour: 'Unlimited' },
  { label: 'Real-time leaderboard', free: true, pro: true, club: true, tour: true },
  { label: 'Tournament chat', free: true, pro: true, club: true, tour: true },
  { label: 'Handicap systems', free: 'Gross only', pro: true, club: true, tour: true },
  { label: 'Shareable link', free: true, pro: true, club: true, tour: true },
  { label: 'Powerups & draft', free: false, pro: true, club: true, tour: true },
  { label: 'Custom branding & colors', free: false, pro: true, club: true, tour: true },
  { label: 'Player flights', free: false, pro: true, club: true, tour: true },
  { label: 'Photo gallery', free: false, pro: '100 photos', club: '250 photos', tour: '1,000 photos' },
  { label: 'GPS & yardages', free: false, pro: true, club: true, tour: true },
  { label: 'Full stats & insights', free: false, pro: true, club: true, tour: true },
  { label: 'Exportable results', free: false, pro: true, club: true, tour: true },
  { label: 'Season-long standings', free: false, pro: false, club: true, tour: true },
  { label: 'Recurring player roster', free: false, pro: false, club: true, tour: true },
  { label: 'Sponsor placements', free: false, pro: false, club: true, tour: true },
  { label: 'Season-over-season player tracking', free: false, pro: false, club: true, tour: true },
  { label: 'Admin seats', free: '1', pro: '1', club: '2', tour: '5' },
  { label: 'Custom subdomain', free: false, pro: false, club: false, tour: true },
  { label: 'Priority email support', free: false, pro: false, club: false, tour: true },
]
