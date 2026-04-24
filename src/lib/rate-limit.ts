const windows = new Map<string, number[]>()

/**
 * Returns true if the rate limit is exceeded.
 * Tracks recent timestamps per key in memory.
 *
 * Single-instance only. State lives in the process `Map`, so it resets on
 * deploy and is not shared across replicas — don't rely on it as the
 * source of truth if the app ever horizontally scales. Swap for Upstash
 * Redis / Vercel KV before moving beyond one server.
 */
export function checkRateLimit(
  key: string,
  maxMessages: number = 5,
  windowMs: number = 10_000,
): boolean {
  const now = Date.now()
  const timestamps = windows.get(key) ?? []
  const recent = timestamps.filter((t) => now - t < windowMs)
  recent.push(now)
  windows.set(key, recent)
  return recent.length > maxMessages
}
