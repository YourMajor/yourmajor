// Player-facing prose for the format-info popup on the leaderboard.
// Pure data, no React — kept separate from registry.ts so the scoring engine
// and API routes don't pull display strings into their bundles.

import type { FormatId } from './types'

export interface FormatExplanation {
  summary: string
  scoringRules: string[]
  handicapNote?: string
  tieBreaker?: string
  exampleLine?: string
}

export const FORMAT_EXPLANATIONS: Record<FormatId, FormatExplanation> = {
  STROKE_PLAY: {
    summary: 'The classic format. Count every stroke; the player with the lowest 18-hole total wins.',
    scoringRules: [
      'Record your strokes on each hole.',
      'Your total is the sum across every hole played.',
      'No handicap is applied — gross strokes only.',
    ],
    tieBreaker: 'Ties broken by best back-9, then back-6, back-3, last hole.',
    exampleLine: 'A round of 4 birdies, 10 pars, 4 bogeys on a par-72 course = 72 − 4 + 4 = 72.',
  },
  STROKE_PLAY_NET: {
    summary: 'Stroke play with WHS handicap allowance. Lowest net 18-hole total wins.',
    scoringRules: [
      'Record your strokes on each hole as normal.',
      'Handicap strokes are allocated to specific holes by their stroke-index (the hardest holes first).',
      'On a hole where you receive a stroke, your net score = gross − 1.',
      'Net total = gross 18-hole total − course handicap.',
    ],
    handicapNote: 'Uses the World Handicap System (WHS): handicap index → course handicap → per-hole strokes by stroke-index.',
    tieBreaker: 'Ties broken by best net back-9, then back-6, back-3, last hole.',
  },
  STABLEFORD: {
    summary: 'Earn points each hole based on your score relative to par. The highest total points wins.',
    scoringRules: [
      'Eagle or better: 4 points',
      'Birdie: 3 points',
      'Par: 2 points',
      'Bogey: 1 point',
      'Double bogey or worse: 0 points',
      'A pickup or unrecorded score counts as 0 points.',
    ],
    handicapNote: 'Net Stableford applies your handicap strokes per hole before scoring — e.g. a bogey on a hole where you get a stroke scores like a par (2 pts).',
    tieBreaker: 'Ties broken by best back-9 points, then back-6, back-3, last hole.',
    exampleLine: '4 birdies, 8 pars, 6 bogeys = 4×3 + 8×2 + 6×1 = 34 points.',
  },
  MODIFIED_STABLEFORD: {
    summary: 'Stableford with a steeper points curve that rewards aggressive play and punishes blow-up holes.',
    scoringRules: [
      'Eagle or better: +5 points',
      'Birdie: +2 points',
      'Par: 0 points',
      'Bogey: −1 point',
      'Double bogey or worse: −3 points',
      'Negative totals are common.',
    ],
    handicapNote: 'Handicap strokes are applied per hole before computing points, same as standard Stableford.',
    exampleLine: '1 eagle, 3 birdies, 9 pars, 4 bogeys, 1 double = 5 + 6 + 0 − 4 − 3 = 4 points.',
  },
  BEST_BALL: {
    summary: 'Each player plays their own ball; the team takes the best (lowest) score on each hole. Legacy alias — defaults to a 2-person team.',
    scoringRules: [
      'Every player plays their own ball from tee to green on every hole.',
      'On each hole, only the team\'s lowest score counts toward the team total.',
      'Higher scores from other teammates are discarded.',
    ],
    handicapNote: 'Net best-ball uses each player\'s WHS strokes; the lowest net score per hole becomes the team score.',
    tieBreaker: 'Ties broken by best team back-9, then back-6, back-3, last hole.',
  },
  BEST_BALL_2: {
    summary: 'Two-person teams. Each player plays their own ball; the team takes the lower score on each hole.',
    scoringRules: [
      'Both partners play their own ball from tee to green.',
      'On each hole, only the lower of the two scores counts.',
      'The other partner\'s score is discarded for that hole.',
    ],
    handicapNote: 'Net best-ball uses each player\'s WHS strokes; the lower net score per hole becomes the team score.',
    tieBreaker: 'Ties broken by best team back-9, then back-6, back-3, last hole.',
    exampleLine: 'Hole 1: A scores 5, B scores 4 → team posts 4.',
  },
  BEST_BALL_4: {
    summary: 'Four-person teams. Each player plays their own ball; the team takes the lowest score on each hole.',
    scoringRules: [
      'All four players play their own ball from tee to green.',
      'On each hole, only the lowest of the four scores counts.',
      'The other three scores are discarded for that hole.',
    ],
    handicapNote: 'Net best-ball uses each player\'s WHS strokes; the lowest net score per hole becomes the team score.',
    tieBreaker: 'Ties broken by best team back-9, then back-6, back-3, last hole.',
  },
  SCRAMBLE: {
    summary: 'A team format. All teammates tee off, the team picks the best shot, then everyone plays again from there. One score per hole.',
    scoringRules: [
      'All teammates tee off; the team selects the best drive.',
      'Every player then hits their next shot from that spot.',
      'Continue selecting the best shot and playing all balls from there until holed.',
      'Only one score is recorded per hole for the whole team.',
    ],
    handicapNote: 'Played gross — no per-player handicap is applied to the team score in this app.',
    tieBreaker: 'Ties broken by best team back-9, then back-6, back-3, last hole.',
  },
  SHAMBLE: {
    summary: 'A scramble off the tee, then individual play. The team takes the best ball from teammate-to-pin.',
    scoringRules: [
      'All teammates tee off; the team picks the best drive.',
      'Each player then plays their own ball into the hole from that spot.',
      'On each hole the team takes the lowest of those individual scores.',
    ],
    handicapNote: 'Net shamble uses each player\'s WHS strokes; the lowest net score per hole becomes the team score.',
    tieBreaker: 'Ties broken by best team back-9, then back-6, back-3, last hole.',
  },
  MATCH_PLAY: {
    summary: 'Hole-by-hole competition. You don\'t count strokes — you count holes won. Whoever leads by more holes than remain wins the match.',
    scoringRules: [
      'On each hole, the lower score wins the hole (1 up).',
      'Tied holes are halved — neither side gains.',
      'A match is decided when one player leads by more holes than are left to play (e.g. "5&4" = 5 up with 4 to play).',
      'You can concede a hole at any time, awarding it to your opponent.',
    ],
    handicapNote: 'This app plays match play gross. The status pill shows things like "3 UP thru 12", "Dormie thru 16", or "AS thru 9".',
    tieBreaker: 'A match level after 18 is recorded as halved (AS).',
  },
  RYDER_CUP: {
    summary: 'Team match play across multiple sessions (foursomes, fourball, singles). Each match earns 1 point for the winning team, ½ for a halved match.',
    scoringRules: [
      'Each match is played as match play — lowest score on a hole wins it.',
      'Winning a match earns the team 1 point.',
      'Halved matches earn each team ½ point.',
      'Team that crosses the points threshold first wins the cup.',
    ],
    handicapNote: 'Played gross. Sessions and pairings are managed off the leaderboard — the leaderboard shows the per-player match-play status.',
  },
  SKINS: {
    summary: 'Each hole is its own mini-contest worth a "skin". Win a skin only by having the lowest score on a hole outright. Ties carry the skin forward.',
    scoringRules: [
      'On each hole, the player with the strictly lowest score wins 1 skin.',
      'If two or more players tie for the low score, no skin is awarded — it carries over.',
      'When a skin carries over, the next hole is worth the carried skins plus its own.',
      'The player with the most skins at the end wins.',
    ],
    handicapNote: 'Uses gross scores — no handicap allowance.',
    exampleLine: 'Hole 1 tied → carry. Hole 2 won outright → winner takes 2 skins.',
  },
  SKINS_GROSS: {
    summary: 'Skins played on raw scores with no handicap allowance. Lowest gross score on a hole wins the skin; ties carry over.',
    scoringRules: [
      'Each hole is worth 1 skin (plus any carried skins from previous ties).',
      'Strictly lowest gross score wins the skin.',
      'Ties cause the skin to carry over to the next hole.',
      'Player with the most skins wins.',
    ],
    handicapNote: 'No handicap strokes — pure gross.',
  },
  SKINS_NET: {
    summary: 'Skins played on net scores after WHS handicap strokes are applied. Lowest net on a hole wins the skin; ties carry over.',
    scoringRules: [
      'Handicap strokes are allocated by stroke-index, the hardest holes first.',
      'On each hole, the strictly lowest net score wins the skin.',
      'Ties cause the skin to carry to the next hole.',
      'Player with the most skins wins.',
    ],
    handicapNote: 'Net allocation means a higher-handicap player can beat a lower-handicap player on indexed holes even with a higher gross score.',
  },
  QUOTA: {
    summary: 'You\'re given a points target based on your handicap, and you\'re trying to beat it.',
    scoringRules: [
      'Your quota = 36 − course handicap (capped at 0).',
      'Earn points per hole: eagle 8, birdie 4, par 2, bogey 1, double-or-worse 0.',
      'Total your points across the round, then subtract your quota.',
      'Highest over-quota wins. Negative totals (under quota) are possible.',
    ],
    handicapNote: 'Higher-handicap players have lower quotas — the format levels the field.',
    exampleLine: 'Handicap 18 → quota 18. Score 22 points → +4 over quota.',
  },
  CALLAWAY: {
    summary: 'A one-day handicap system for casual outings. Your handicap is computed from your worst holes within the round itself — no prior handicap needed.',
    scoringRules: [
      'Play stroke play normally.',
      'After the round, your gross score determines how many of your worst holes (1-16 only — never 17 or 18) get deducted.',
      'A small adjustment is then added or subtracted based on your gross.',
      'Net score = gross − Callaway allowance. Lowest net wins.',
    ],
    handicapNote: 'No handicap card required — perfect for one-time outings with mixed-ability players.',
    tieBreaker: 'Ties broken by lowest gross score.',
  },
  PEORIA: {
    summary: 'Six holes are secretly chosen before the round. Your handicap for the day is computed only from how you played those six holes.',
    scoringRules: [
      'Strokes are recorded normally on all 18 holes.',
      'After the round completes, the 6 secret holes are revealed.',
      'Peoria handicap = round((sum of strokes on those 6 × 3 − coursePar) × 0.80), clamped to [0, 36].',
      'Net = 18-hole gross total − Peoria handicap. Lowest net wins.',
    ],
    handicapNote: 'No prior handicap is needed — Peoria computes one for each player from this round only. Designed to discourage sandbagging since you don\'t know which holes count.',
    tieBreaker: 'Ties broken by lowest gross score.',
  },
  CHAPMAN: {
    summary: 'A two-person partner format. Both players tee off, swap balls for the second shot, then alternate shots until holed.',
    scoringRules: [
      'Both partners tee off on every hole.',
      'For their second shots, partners switch balls — each plays the other\'s drive.',
      'After the second shots, the team selects one ball and alternates shots from there until holed.',
      'One score is recorded per hole for the team.',
    ],
    handicapNote: 'Net Chapman uses team strokes by stroke-index — typically a fraction of the combined partner handicaps.',
    tieBreaker: 'Ties broken by best team back-9, then back-6, back-3, last hole.',
  },
  PINEHURST: {
    summary: 'A two-person partner format. Both players tee off and play their second shots, then the team picks one ball and alternates shots until holed.',
    scoringRules: [
      'Both partners tee off on every hole.',
      'Each player hits their own second shot.',
      'The team then chooses the better-positioned ball and alternates shots from there until holed.',
      'One score is recorded per hole for the team.',
    ],
    handicapNote: 'Net Pinehurst uses team strokes by stroke-index — typically a fraction of the combined partner handicaps.',
    tieBreaker: 'Ties broken by best team back-9, then back-6, back-3, last hole.',
  },
  LOW_GROSS_LOW_NET: {
    summary: 'Two competitions in one. Winners are crowned in both gross and net divisions — different players can win each.',
    scoringRules: [
      'Every player plays the same stroke-play round.',
      'Lowest gross 18-hole total wins the gross title.',
      'Lowest net total (gross − WHS course handicap) wins the net title.',
      'The same player can win both, or two different players can split the titles.',
    ],
    handicapNote: 'Net uses World Handicap System (WHS) allocation by stroke-index.',
    tieBreaker: 'Each title ties broken independently by best back-9, back-6, back-3, last hole on the relevant scoring axis.',
  },
  NASSAU: {
    summary: 'Three sub-matches in one round — front 9, back 9, and overall 18. Each is its own match-play scoreboard.',
    scoringRules: [
      'Match play scoring is computed independently on holes 1–9, holes 10–18, and the full 18.',
      'Each sub-match is worth 1 point — closing one out doesn\'t affect the others.',
      'Player who wins more of the three sub-matches wins the round; halved sub-matches split the point.',
    ],
    handicapNote: 'Played gross. Designed for heads-up (1-vs-1) play. With more than 2 players this app aggregates holes-up across the field, which can produce unusual labels.',
    tieBreaker: 'Each sub-match level after its final hole is recorded as halved (AS).',
  },
}

export function getExplanation(id: string | null | undefined): FormatExplanation {
  if (!id || !(id in FORMAT_EXPLANATIONS)) return FORMAT_EXPLANATIONS.STROKE_PLAY
  return FORMAT_EXPLANATIONS[id as FormatId]
}
