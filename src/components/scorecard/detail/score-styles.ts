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
  eagle:  { cell: 'rounded-full border-2 border-red-500',               text: 'text-red-600',    dot: '#b8860b', doubleRing: 'rounded-full border-2 border-red-500' },
  birdie: { cell: 'rounded-full border-2 border-red-500',               text: 'text-red-600',    dot: '#dc2626' },
  par:    { cell: 'border border-border/40 rounded-sm',                  text: 'text-foreground', dot: '#6b7280' },
  bogey:  { cell: 'border-2 border-gray-700 rounded-none',              text: 'text-foreground', dot: '#374151' },
  double: { cell: 'border-2 border-gray-700 rounded-none',              text: 'text-gray-600',   dot: '#1f2937', doubleRing: 'border-2 border-gray-700 rounded-none' },
}
