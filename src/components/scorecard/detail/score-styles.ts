export type ScoreType = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double'

export function getScoreType(strokes: number, par: number): ScoreType {
  const d = strokes - par
  if (d <= -2) return 'eagle'
  if (d === -1) return 'birdie'
  if (d === 0)  return 'par'
  if (d === 1)  return 'bogey'
  return 'double'
}

/**
 * The read-only, form and admin scorecards. Score type is carried by border
 * shape as well as hue, so it survives without colour: eagle is a double ring,
 * birdie a single ring, par a hairline square, bogey a heavy square, double a
 * heavy square in the faded ink.
 */
export const SCORE_STYLE: Record<ScoreType, { cell: string; text: string; dot: string; doubleRing?: string }> = {
  eagle:  { cell: 'rounded-full border-2 border-score-eagle',            text: 'text-score-eagle',  dot: 'var(--score-eagle)',  doubleRing: 'rounded-full border-2 border-score-eagle' },
  birdie: { cell: 'rounded-full border-2 border-score-birdie',           text: 'text-score-birdie', dot: 'var(--score-birdie)' },
  par:    { cell: 'border border-border/40 rounded-sm',                  text: 'text-score-par',    dot: 'var(--score-par)' },
  bogey:  { cell: 'border-2 border-score-bogey rounded-none',            text: 'text-score-bogey',  dot: 'var(--score-bogey)' },
  double: { cell: 'border-2 border-score-double rounded-none',           text: 'text-score-double', dot: 'var(--score-double)', doubleRing: 'border-2 border-score-double rounded-none' },
}

/**
 * The live-scoring card speaks a different dialect on purpose. It renders on the
 * branded play surface, where --score-birdie red would fight the tournament
 * colour, so under-par uses the brand ring instead of the score hue.
 *
 * Shape still carries eagle vs birdie — the ring-plus-border gives eagle a
 * concentric double circle on a single element, since these cells are buttons
 * with nothing to nest inside.
 */
export const LIVE_SCORE_STYLE: Record<ScoreType | 'empty', string> = {
  eagle:  'text-brand border-2 border-[var(--color-primary)] rounded-full font-extrabold ring-1 ring-[var(--color-primary)] ring-offset-2 ring-offset-background',
  birdie: 'text-brand border-2 border-[var(--color-primary)] rounded-full',
  par:    'text-foreground',
  bogey:  'text-foreground border border-foreground/40',
  double: 'text-foreground border-2 border-foreground/40',
  empty:  'text-muted-foreground',
}
