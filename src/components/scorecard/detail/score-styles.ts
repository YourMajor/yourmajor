export type ScoreType = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double'

export function getScoreType(strokes: number, par: number): ScoreType {
  const d = strokes - par
  if (d <= -2) return 'eagle'
  if (d === -1) return 'birdie'
  if (d === 0)  return 'par'
  if (d === 1)  return 'bogey'
  return 'double'
}

export const SCORE_STYLE: Record<ScoreType, { cell: string; text: string; dot: string; doubleRing?: string }> = {
  eagle:  { cell: 'rounded-full border-2 border-score-eagle',            text: 'text-score-eagle',  dot: 'var(--score-eagle)',  doubleRing: 'rounded-full border-2 border-score-eagle' },
  birdie: { cell: 'rounded-full border-2 border-score-birdie',           text: 'text-score-birdie', dot: 'var(--score-birdie)' },
  par:    { cell: 'border border-border/40 rounded-sm',                  text: 'text-score-par',    dot: 'var(--score-par)' },
  bogey:  { cell: 'border-2 border-score-bogey rounded-none',            text: 'text-score-bogey',  dot: 'var(--score-bogey)' },
  double: { cell: 'border-2 border-score-double rounded-none',           text: 'text-score-double', dot: 'var(--score-double)', doubleRing: 'border-2 border-score-double rounded-none' },
}
