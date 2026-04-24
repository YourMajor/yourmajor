// Pure types for the tournament format library.
// CLIENT-SAFE — no prisma/pg imports here.

import type { PlayerStanding } from '@/lib/scoring-utils'

export type FormatScoringMode =
  | 'STROKE'
  | 'STABLEFORD'
  | 'MATCH'
  | 'SKINS'
  | 'QUOTA'
  | 'COMBINED'

export type FormatKind = 'individual' | 'team' | 'match'

export type FormatId =
  | 'STROKE_PLAY'
  | 'STABLEFORD'
  | 'MODIFIED_STABLEFORD'
  | 'BEST_BALL'
  | 'BEST_BALL_2'
  | 'BEST_BALL_4'
  | 'SCRAMBLE'
  | 'SHAMBLE'
  | 'MATCH_PLAY'
  | 'RYDER_CUP'
  | 'SKINS'
  | 'SKINS_GROSS'
  | 'SKINS_NET'
  | 'QUOTA'
  | 'CHAPMAN'
  | 'PINEHURST'
  | 'LOW_GROSS_LOW_NET'

export interface FormatDef {
  id: FormatId
  label: string
  description: string
  kind: FormatKind
  requiresTeams: boolean
  defaultTeamSize: number | null
  scoringMode: FormatScoringMode
  supportsNet: boolean
  // Free-form per-format config schema validated at the call site (Zod lives in registry.ts).
}

// Hole-level data the scoring engine sees.
export interface ScoringHole {
  number: number
  par: number
  handicap: number | null
}

export interface ScoringScore {
  holeNumber: number
  par: number
  strokes: number
  handicap: number | null   // hole's stroke-index, not the player's
  roundNumber: number
}

export interface ScoringPlayer {
  tournamentPlayerId: string
  userId: string
  name: string
  avatarUrl: string | null
  handicap: number
  scores: ScoringScore[]
  scoreModifier: number   // sum of powerup modifiers
  teamId: string | null
}

export interface ScoringTeam {
  id: string
  name: string
  color: string | null
  memberIds: string[]   // tournamentPlayerId list
}

export interface ScoringContext {
  tournamentId: string
  format: FormatId
  formatConfig: Record<string, unknown> | null
  handicapSystem: 'NONE' | 'WHS' | 'STABLEFORD' | 'CALLAWAY' | 'PEORIA'
  holes: ScoringHole[]              // canonical hole list (round 1 used as the index)
  rounds: Array<{ roundNumber: number; par: number }>
  players: ScoringPlayer[]
  teams: ScoringTeam[]
}

export interface FormatStrategy {
  id: FormatId
  computeStandings(ctx: ScoringContext): PlayerStanding[]
}
