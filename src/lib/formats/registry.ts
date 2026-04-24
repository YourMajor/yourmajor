// CLIENT-SAFE registry of tournament formats.
// No prisma/pg imports — UI and server both consume this.

import type { FormatDef, FormatId } from './types'

export const FORMATS: FormatDef[] = [
  {
    id: 'STROKE_PLAY',
    label: 'Stroke Play',
    description: 'Classic format. Lowest total strokes wins (gross or net).',
    kind: 'individual',
    requiresTeams: false,
    defaultTeamSize: null,
    scoringMode: 'STROKE',
    supportsNet: true,
  },
  {
    id: 'STABLEFORD',
    label: 'Stableford',
    description: 'Earn points per hole based on score relative to par. Highest total wins.',
    kind: 'individual',
    requiresTeams: false,
    defaultTeamSize: null,
    scoringMode: 'STABLEFORD',
    supportsNet: true,
  },
  {
    id: 'MODIFIED_STABLEFORD',
    label: 'Modified Stableford',
    description: 'Stableford with a steeper points curve (eagle = 5, birdie = 2, par = 0, bogey = -1, double = -3).',
    kind: 'individual',
    requiresTeams: false,
    defaultTeamSize: null,
    scoringMode: 'STABLEFORD',
    supportsNet: true,
  },
  {
    id: 'BEST_BALL_2',
    label: 'Best Ball (2-Person)',
    description: 'Each player plays their own ball; team takes the lower score on each hole.',
    kind: 'team',
    requiresTeams: true,
    defaultTeamSize: 2,
    scoringMode: 'STROKE',
    supportsNet: true,
  },
  {
    id: 'BEST_BALL_4',
    label: 'Best Ball (4-Person)',
    description: 'Each player plays their own ball; team takes the lowest score per hole.',
    kind: 'team',
    requiresTeams: true,
    defaultTeamSize: 4,
    scoringMode: 'STROKE',
    supportsNet: true,
  },
  {
    id: 'BEST_BALL',
    label: 'Best Ball',
    description: 'Legacy best-ball alias — defaults to 2-person.',
    kind: 'team',
    requiresTeams: true,
    defaultTeamSize: 2,
    scoringMode: 'STROKE',
    supportsNet: true,
  },
  {
    id: 'SCRAMBLE',
    label: 'Scramble',
    description: 'All teammates tee off; team plays the best shot. One team score per hole.',
    kind: 'team',
    requiresTeams: true,
    defaultTeamSize: 4,
    scoringMode: 'STROKE',
    supportsNet: true,
  },
  {
    id: 'SHAMBLE',
    label: 'Shamble',
    description: 'All tee off, take the best drive, then each player plays their own ball in. Team takes best ball after drive.',
    kind: 'team',
    requiresTeams: true,
    defaultTeamSize: 4,
    scoringMode: 'STROKE',
    supportsNet: true,
  },
  {
    id: 'CHAPMAN',
    label: 'Chapman / Pinehurst',
    description: 'Both partners tee off, switch balls for second shot, then alternate shots until holed.',
    kind: 'team',
    requiresTeams: true,
    defaultTeamSize: 2,
    scoringMode: 'STROKE',
    supportsNet: true,
  },
  {
    id: 'PINEHURST',
    label: 'Pinehurst',
    description: 'Same as Chapman — alternate shot variant.',
    kind: 'team',
    requiresTeams: true,
    defaultTeamSize: 2,
    scoringMode: 'STROKE',
    supportsNet: true,
  },
  {
    id: 'MATCH_PLAY',
    label: 'Match Play',
    description: 'Hole-by-hole competition. Player who wins more holes wins the match.',
    kind: 'match',
    requiresTeams: false,
    defaultTeamSize: null,
    scoringMode: 'MATCH',
    supportsNet: true,
  },
  {
    id: 'RYDER_CUP',
    label: 'Ryder Cup Match Play',
    description: 'Team match play across multiple sessions (foursomes, fourball, singles).',
    kind: 'match',
    requiresTeams: true,
    defaultTeamSize: 12,
    scoringMode: 'MATCH',
    supportsNet: true,
  },
  {
    id: 'SKINS',
    label: 'Skins',
    description: 'Win a skin by having the lowest score on a hole outright. Ties carry over.',
    kind: 'individual',
    requiresTeams: false,
    defaultTeamSize: null,
    scoringMode: 'SKINS',
    supportsNet: false,
  },
  {
    id: 'SKINS_GROSS',
    label: 'Skins (Gross)',
    description: 'Skins played on raw scores with no handicap allowance.',
    kind: 'individual',
    requiresTeams: false,
    defaultTeamSize: null,
    scoringMode: 'SKINS',
    supportsNet: false,
  },
  {
    id: 'SKINS_NET',
    label: 'Skins (Net)',
    description: 'Skins played on net scores after handicap strokes are applied.',
    kind: 'individual',
    requiresTeams: false,
    defaultTeamSize: null,
    scoringMode: 'SKINS',
    supportsNet: true,
  },
  {
    id: 'QUOTA',
    label: 'Quota Points',
    description: 'Each player has a target quota; earn points per hole and beat your number.',
    kind: 'individual',
    requiresTeams: false,
    defaultTeamSize: null,
    scoringMode: 'QUOTA',
    supportsNet: true,
  },
  {
    id: 'LOW_GROSS_LOW_NET',
    label: 'Low Gross / Low Net',
    description: 'Two combined competitions in one — winners crowned in both gross and net divisions.',
    kind: 'individual',
    requiresTeams: false,
    defaultTeamSize: null,
    scoringMode: 'COMBINED',
    supportsNet: true,
  },
]

const FORMAT_BY_ID: Record<FormatId, FormatDef> = Object.fromEntries(
  FORMATS.map((f) => [f.id, f]),
) as Record<FormatId, FormatDef>

export function getFormat(id: FormatId | string | null | undefined): FormatDef {
  if (!id || !(id in FORMAT_BY_ID)) return FORMAT_BY_ID.STROKE_PLAY
  return FORMAT_BY_ID[id as FormatId]
}

export function isTeamFormat(id: FormatId | string | null | undefined): boolean {
  return getFormat(id).requiresTeams
}

export function isMatchFormat(id: FormatId | string | null | undefined): boolean {
  return getFormat(id).kind === 'match'
}

// Default per-format config used when creating a tournament.
// Per-format options are kept simple and JSON-serialisable.
export function defaultFormatConfig(id: FormatId): Record<string, unknown> | null {
  switch (id) {
    case 'MODIFIED_STABLEFORD':
      return { points: { eagle: 5, birdie: 2, par: 0, bogey: -1, doubleOrWorse: -3 } }
    case 'STABLEFORD':
      return { points: { eagle: 4, birdie: 3, par: 2, bogey: 1, doubleOrWorse: 0 } }
    case 'SKINS':
    case 'SKINS_GROSS':
    case 'SKINS_NET':
      return { carryOver: true, valuePerSkin: 1 }
    case 'QUOTA':
      return { quotaSource: 'HANDICAP', basePoints: { eagle: 8, birdie: 4, par: 2, bogey: 1, doubleOrWorse: 0 } }
    default:
      return null
  }
}
