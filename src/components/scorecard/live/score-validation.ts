// Pure scoring validation functions -- no React, no side effects

/** Putts cannot exceed strokes - 1 (you need at least 1 non-putt stroke) */
export function maxPutts(strokes: number | null): number {
  if (strokes === null || strokes < 1) return 0
  return strokes - 1
}

export function isValidPutts(putts: number, strokes: number | null): boolean {
  if (strokes === null) return putts >= 0
  return putts >= 0 && putts <= maxPutts(strokes)
}

/**
 * GIR = reached the green in (par - 2) strokes or fewer.
 * So: (strokes - putts) <= (par - 2)
 */
export function computeGir(
  strokes: number | null,
  putts: number | null,
  par: number,
): boolean | null {
  if (strokes === null || putts === null) return null
  return (strokes - putts) <= (par - 2)
}

/** Whether the user is allowed to manually toggle GIR on */
export function canToggleGirOn(
  strokes: number | null,
  putts: number | null,
  par: number,
): boolean {
  if (strokes === null || putts === null) return false
  return (strokes - putts) <= (par - 2)
}

/** Clamp putts down if they exceed the new max after a stroke change */
export function clampPutts(
  currentPutts: number | null,
  newStrokes: number | null,
): number | null {
  if (currentPutts === null || newStrokes === null) return currentPutts
  const max = maxPutts(newStrokes)
  return currentPutts > max ? max : currentPutts
}

/** Par 3 holes have no fairway -- hide the toggle */
export function hasFairway(par: number): boolean {
  return par > 3
}
