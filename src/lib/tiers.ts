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
    maxTournamentsPerMonth: 1,
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
  LEAGUE_SEASON: { amount: 19900, label: '$199', description: '/season' },
} as const

/** Features list for each tier — used by pricing page */
export const TIER_FEATURES: Record<PricingTier, string[]> = {
  FREE: [
    'Up to 16 players',
    '1 round per tournament',
    'Real-time leaderboard',
    'Tournament chat',
    'All 4 handicap systems',
    'Shareable tournament link',
  ],
  PRO: [
    'Up to 72 players',
    'Up to 4 rounds',
    'Powerups unlocked',
    'Custom branding (logo & colors)',
    'Player flight management',
    'Gallery & photos',
    'GPS & yardages',
    'Full stats & insights',
    'Exportable results & stats',
    'Everything in Free',
  ],
  LEAGUE: [
    'Unlimited events per season',
    'Season-long standings & stats',
    'Recurring player roster',
    'All Pro features included',
  ],
}

/** What each tier does NOT include — shown on pricing page */
export const TIER_NEGATIVES: Record<PricingTier, string[]> = {
  FREE: [
    'No powerups or draft',
    'No custom branding',
    'No GPS/yardages',
    'No gallery uploads',
    'Limited stats — no insights',
    '1 tournament per month',
  ],
  PRO: [
    'No season-long standings',
    'No recurring player roster',
    'Per-tournament purchase',
  ],
  LEAGUE: [],
}

/** Feature comparison rows for the pricing table */
export const COMPARISON_FEATURES: Array<{
  label: string
  free: string | boolean
  pro: string | boolean
  tour: string | boolean
}> = [
  { label: 'Players per tournament', free: 'Up to 16', pro: 'Up to 72', tour: 'Up to 144' },
  { label: 'Rounds per tournament', free: '1', pro: 'Up to 4', tour: 'Unlimited' },
  { label: 'Tournaments per month', free: '1', pro: 'Per credit', tour: 'Unlimited' },
  { label: 'Real-time leaderboard', free: true, pro: true, tour: true },
  { label: 'Tournament chat', free: true, pro: true, tour: true },
  { label: 'Handicap systems', free: true, pro: true, tour: true },
  { label: 'Shareable link', free: true, pro: true, tour: true },
  { label: 'Powerups & draft', free: false, pro: true, tour: true },
  { label: 'Custom branding & colors', free: false, pro: true, tour: true },
  { label: 'Player flights', free: false, pro: true, tour: true },
  { label: 'Photo gallery', free: false, pro: true, tour: true },
  { label: 'GPS & yardages', free: false, pro: true, tour: true },
  { label: 'Full stats & insights', free: false, pro: true, tour: true },
  { label: 'Exportable results', free: false, pro: true, tour: true },
  { label: 'Season-long standings', free: false, pro: false, tour: true },
  { label: 'Recurring player roster', free: false, pro: false, tour: true },
]
