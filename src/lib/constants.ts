// ─── Animation & Timing Constants ─────────────────────────────────────────

export const ANIMATION = {
  CARD_FLIP_MS: 650,
  DEAL_ANIMATION_MS: 1500,
  HIGHLIGHT_DURATION_MS: 1500,
  SUCCESS_MESSAGE_MS: 2000,
} as const

export const INTERVALS = {
  LEADERBOARD_REFRESH_MS: 15000,
  LIVE_SCORE_DEBOUNCE_MS: 1500,
  POWERUP_MESSAGE_DISPLAY_MS: 5000,
} as const

export const GEOLOCATION = {
  MAX_AGE_MS: 5000,
  TIMEOUT_MS: 15000,
} as const

// ─── Validation Constants ─────────────────────────────────────────────────

export const SCORING = {
  MIN_STROKES: 1,
  MAX_STROKES: 20,
  MIN_PUTTS: 0,
  MAX_PUTTS: 10,
  MIN_HANDICAP: 0,
  MAX_HANDICAP: 54,
} as const
