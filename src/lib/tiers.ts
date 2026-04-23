import type { PricingTier } from '@/generated/prisma/client'

export type TierLimits = {
  maxPlayers: number
  maxRounds: number
  powerups: boolean
  customBranding: boolean
  flights: boolean
  exportResults: boolean
  gallery: boolean
  gps: boolean
  insights: boolean
  colorSelection: boolean
  maxTournamentsPerMonth: number
}

export const TIER_LIMITS: Record<PricingTier, TierLimits> = {
  FREE: {
    maxPlayers: 16,
    maxRounds: 1,
    powerups: false,
    customBranding: false,
    flights: false,
    exportResults: false,
    gallery: false,
    gps: false,
    insights: false,
    colorSelection: false,
    maxTournamentsPerMonth: Infinity,
  },
  PRO: {
    maxPlayers: 72,
    maxRounds: 4,
    powerups: true,
    customBranding: true,
    flights: true,
    exportResults: true,
    gallery: true,
    gps: true,
    insights: true,
    colorSelection: true,
    maxTournamentsPerMonth: Infinity,
  },
  CLUB: {
    maxPlayers: 72,
    maxRounds: 4,
    powerups: true,
    customBranding: true,
    flights: true,
    exportResults: true,
    gallery: true,
    gps: true,
    insights: true,
    colorSelection: true,
    maxTournamentsPerMonth: 4,
  },
  LEAGUE: {
    maxPlayers: 144,
    maxRounds: 99,
    powerups: true,
    customBranding: true,
    flights: true,
    exportResults: true,
    gallery: true,
    gps: true,
    insights: true,
    colorSelection: true,
    maxTournamentsPerMonth: Infinity,
  },
}

export const TIER_PRICES = {
  PRO: { amount: 2900, label: '$29', description: 'per tournament' },
  CLUB: { amount: 9900, label: '$99', description: '/month' },
  LEAGUE_SEASON: { amount: 149900, label: '$1,499', description: '/year' },
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
    'Up to 72 players & 4 rounds',
    'Powerups unlocked',
    'Custom branding (logo & colors)',
    'Player flight management',
    'Gallery & photos',
    'GPS & yardages',
    'Full stats & insights',
  ],
  CLUB: [
    '4 tournaments per month',
    'All Pro features included',
    'Season-long standings & stats',
    'Recurring player roster',
    'Cancel anytime',
  ],
  LEAGUE: [
    'Unlimited events per year',
    'Up to 144 players per event',
    'Season-long standings & stats',
    'Recurring player roster',
    'All Pro features included',
  ],
}

/** What each tier does NOT include — shown on pricing page */
export const TIER_NEGATIVES: Record<PricingTier, string[]> = {
  FREE: [
    'Gross scoring only — no handicap systems',
    'No powerups or draft',
    'No custom branding',
    'No GPS/yardages',
    'No gallery uploads',
    'Limited stats — no insights',
  ],
  PRO: [
    'No season-long standings',
    'No recurring player roster',
    'Per-tournament purchase',
  ],
  CLUB: [
    'Max 4 tournaments per month',
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
  { label: 'Rounds per tournament', free: '1', pro: 'Up to 4', club: 'Up to 4', tour: 'Unlimited' },
  { label: 'Tournaments per month', free: 'Unlimited', pro: 'Per credit', club: 'Up to 4', tour: 'Unlimited' },
  { label: 'Real-time leaderboard', free: true, pro: true, club: true, tour: true },
  { label: 'Tournament chat', free: true, pro: true, club: true, tour: true },
  { label: 'Handicap systems', free: 'Gross only', pro: true, club: true, tour: true },
  { label: 'Shareable link', free: true, pro: true, club: true, tour: true },
  { label: 'Powerups & draft', free: false, pro: true, club: true, tour: true },
  { label: 'Custom branding & colors', free: false, pro: true, club: true, tour: true },
  { label: 'Player flights', free: false, pro: true, club: true, tour: true },
  { label: 'Photo gallery', free: false, pro: true, club: true, tour: true },
  { label: 'GPS & yardages', free: false, pro: true, club: true, tour: true },
  { label: 'Full stats & insights', free: false, pro: true, club: true, tour: true },
  { label: 'Exportable results', free: false, pro: true, club: true, tour: true },
  { label: 'Season-long standings', free: false, pro: false, club: true, tour: true },
  { label: 'Recurring player roster', free: false, pro: false, club: true, tour: true },
]
