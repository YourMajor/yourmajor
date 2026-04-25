// CLIENT-SAFE strategy map.

import type { FormatId, FormatStrategy } from './types'
import { strokePlayStrategy } from './strokePlay'
import { stablefordStrategy, modifiedStablefordStrategy } from './stableford'
import { skinsStrategy, skinsGrossStrategy, skinsNetStrategy } from './skins'
import { bestBallStrategy, bestBall2Strategy, bestBall4Strategy } from './bestBall'
import { scrambleStrategy, shambleStrategy, chapmanStrategy, pinehurstStrategy } from './scramble'
import { matchPlayStrategy, ryderCupStrategy } from './match'
import { quotaStrategy } from './quota'
import { lowGrossLowNetStrategy } from './combined'

export const STRATEGIES: Record<FormatId, FormatStrategy> = {
  STROKE_PLAY: strokePlayStrategy,
  // STROKE_PLAY_NET / CALLAWAY / PEORIA all run stroke-play scoring; the
  // handicap calculation differs and is handled inside strokePlayStrategy
  // by reading ctx.handicapSystem (which is locked by the format's
  // impliedHandicap when the user picks one of these cards).
  STROKE_PLAY_NET: strokePlayStrategy,
  CALLAWAY: strokePlayStrategy,
  PEORIA: strokePlayStrategy,
  STABLEFORD: stablefordStrategy,
  MODIFIED_STABLEFORD: modifiedStablefordStrategy,
  BEST_BALL: bestBallStrategy,
  BEST_BALL_2: bestBall2Strategy,
  BEST_BALL_4: bestBall4Strategy,
  SCRAMBLE: scrambleStrategy,
  SHAMBLE: shambleStrategy,
  MATCH_PLAY: matchPlayStrategy,
  RYDER_CUP: ryderCupStrategy,
  SKINS: skinsStrategy,
  SKINS_GROSS: skinsGrossStrategy,
  SKINS_NET: skinsNetStrategy,
  QUOTA: quotaStrategy,
  CHAPMAN: chapmanStrategy,
  PINEHURST: pinehurstStrategy,
  LOW_GROSS_LOW_NET: lowGrossLowNetStrategy,
}

export function getStrategy(id: FormatId | string | null | undefined): FormatStrategy {
  const key = (id && id in STRATEGIES ? id : 'STROKE_PLAY') as FormatId
  return STRATEGIES[key]
}

export type { FormatStrategy, FormatDef, FormatId, ScoringContext, ScoringPlayer, ScoringScore, ScoringHole } from './types'
export { FORMATS, getFormat, isTeamFormat, isMatchFormat, defaultFormatConfig } from './registry'
