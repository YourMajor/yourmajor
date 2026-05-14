// Client-side mutation queue for live scoring. Survives reload via localStorage
// and retries automatically on reconnect / visibility / interval. The two
// supported mutation kinds are score saves and powerup activations — both
// fired from the live-scoring page where a phone may be on spotty signal.
//
// Server-side idempotency: /api/scores uses upsert so duplicate POSTs are
// harmless. /api/tournaments/[id]/powerups/activate returns HTTP 400
// "Powerup already used" on retry; the queue treats that response as terminal
// success and removes the item.

export interface ScoreMutationPayload {
  tournamentPlayerId: string
  holeId: string
  roundId: string
  strokes: number
  fairwayHit: boolean | null
  gir: boolean | null
  putts: number | null
  conceded?: boolean
}

export interface PowerupActivatePayload {
  playerPowerupId: string
  roundId: string
  holeNumber: number
  targetPlayerId?: string
  targetHoleNumber?: number
  metadata?: Record<string, unknown>
}

export interface ScoreSuccessResponse {
  powerupEvaluations?: unknown
  pendingConfirmations?: unknown
  [key: string]: unknown
}

type ScoreMutation = {
  kind: 'score'
  id: string
  payload: ScoreMutationPayload
  attempts: number
  nextAttemptAt: number
  createdAt: number
}

type PowerupMutation = {
  kind: 'powerup-activate'
  id: string
  tournamentId: string
  payload: PowerupActivatePayload
  attempts: number
  nextAttemptAt: number
  createdAt: number
}

export type PendingMutation = ScoreMutation | PowerupMutation

export interface OfflineQueueHandlers {
  onScoreSuccess?: (payload: ScoreMutationPayload, response: ScoreSuccessResponse) => void
  onScoreSettled?: (payload: ScoreMutationPayload, result: { ok: boolean; queued: boolean }) => void
  onPowerupSuccess?: (payload: PowerupActivatePayload, response: unknown) => void
  onPowerupAlreadyUsed?: (payload: PowerupActivatePayload) => void
  onPowerupTerminalFailure?: (payload: PowerupActivatePayload, error: string) => void
}

export interface OfflineQueueDeps {
  fetchFn?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  now?: () => number
}

export interface OfflineQueue {
  enqueueScore: (payload: ScoreMutationPayload) => void
  enqueuePowerupActivate: (tournamentId: string, payload: PowerupActivatePayload) => void
  drain: () => Promise<void>
  start: () => void
  stop: () => void
  size: () => number
  snapshot: () => PendingMutation[]
}

const BACKOFF_LADDER_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000]
const STALE_AFTER_MS = 24 * 60 * 60 * 1_000  // 24h
const INTERVAL_MS = 10_000
const STORAGE_PREFIX = 'offline-queue:'

function safeStorage(custom?: OfflineQueueDeps['storage']): OfflineQueueDeps['storage'] | null {
  if (custom) return custom
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function backoffFor(attempts: number): number {
  const idx = Math.min(attempts, BACKOFF_LADDER_MS.length - 1)
  return BACKOFF_LADDER_MS[idx]
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createOfflineQueue(
  roundId: string,
  handlers: OfflineQueueHandlers,
  deps: OfflineQueueDeps = {},
): OfflineQueue {
  const storage = safeStorage(deps.storage)
  const fetchFn = deps.fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null)
  const now = deps.now ?? (() => Date.now())
  const storageKey = `${STORAGE_PREFIX}${roundId}`

  let queue: PendingMutation[] = loadInitial()
  let drainPromise: Promise<void> | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null
  let started = false

  // Listener refs so stop() can detach them
  const onOnline = () => { void drain() }
  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void drain()
    }
  }

  function loadInitial(): PendingMutation[] {
    if (!storage) return []
    try {
      const raw = storage.getItem(storageKey)
      if (!raw) return []
      const parsed = JSON.parse(raw) as PendingMutation[]
      if (!Array.isArray(parsed)) return []
      const cutoff = now() - STALE_AFTER_MS
      return parsed.filter((m) => m && typeof m === 'object' && m.createdAt > cutoff)
    } catch {
      return []
    }
  }

  function persist(): void {
    if (!storage) return
    try {
      if (queue.length === 0) {
        storage.removeItem(storageKey)
      } else {
        storage.setItem(storageKey, JSON.stringify(queue))
      }
    } catch {
      // Quota / serialization error — drop oldest entries until it fits or
      // we're empty. Score payloads are tiny; this should rarely trigger.
      while (queue.length > 0) {
        queue.shift()
        try {
          storage.setItem(storageKey, JSON.stringify(queue))
          return
        } catch {
          // keep dropping
        }
      }
      try { storage.removeItem(storageKey) } catch { /* noop */ }
    }
  }

  function enqueueScore(payload: ScoreMutationPayload): void {
    const t = now()
    const mutation: ScoreMutation = {
      kind: 'score',
      id: generateId(),
      payload,
      attempts: 0,
      nextAttemptAt: t,
      createdAt: t,
    }
    queue.push(mutation)
    persist()
    void drain()
  }

  function enqueuePowerupActivate(tournamentId: string, payload: PowerupActivatePayload): void {
    const t = now()
    const mutation: PowerupMutation = {
      kind: 'powerup-activate',
      id: generateId(),
      tournamentId,
      payload,
      attempts: 0,
      nextAttemptAt: t,
      createdAt: t,
    }
    queue.push(mutation)
    persist()
    void drain()
  }

  function findReadyItem(): PendingMutation | null {
    const t = now()
    return queue.find((m) => m.nextAttemptAt <= t) ?? null
  }

  async function postScore(payload: ScoreMutationPayload): Promise<Response> {
    if (!fetchFn) throw new Error('fetch unavailable')
    return fetchFn('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  async function postPowerup(tournamentId: string, payload: PowerupActivatePayload): Promise<Response> {
    if (!fetchFn) throw new Error('fetch unavailable')
    return fetchFn(`/api/tournaments/${tournamentId}/powerups/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  function removeById(id: string): void {
    queue = queue.filter((m) => m.id !== id)
    persist()
  }

  function reschedule(id: string): void {
    const item = queue.find((m) => m.id === id)
    if (!item) return
    item.attempts += 1
    item.nextAttemptAt = now() + backoffFor(item.attempts)
    persist()
  }

  async function processScore(item: ScoreMutation): Promise<void> {
    try {
      const res = await postScore(item.payload)
      if (res.ok) {
        let body: ScoreSuccessResponse = {}
        try { body = (await res.json()) as ScoreSuccessResponse } catch { /* empty body */ }
        removeById(item.id)
        handlers.onScoreSuccess?.(item.payload, body)
        handlers.onScoreSettled?.(item.payload, { ok: true, queued: false })
        return
      }
      // Server-side errors
      if (res.status === 401 || res.status === 403) {
        // Auth — pause the queue, let next mount restart it
        reschedule(item.id)
        handlers.onScoreSettled?.(item.payload, { ok: false, queued: true })
        stop()
        return
      }
      if (res.status >= 400 && res.status < 500) {
        // Validation error — drop, won't fix itself by retrying
        let msg = `HTTP ${res.status}`
        try { const j = await res.json(); if (j?.error) msg = String(j.error) } catch { /* noop */ }
        console.error('[offline-queue] score POST dropped (terminal):', msg, item.payload)
        removeById(item.id)
        handlers.onScoreSettled?.(item.payload, { ok: false, queued: false })
        return
      }
      // 5xx — retry
      reschedule(item.id)
      handlers.onScoreSettled?.(item.payload, { ok: false, queued: true })
    } catch {
      // Network error — retry
      reschedule(item.id)
      handlers.onScoreSettled?.(item.payload, { ok: false, queued: true })
    }
  }

  async function processPowerup(item: PowerupMutation): Promise<void> {
    try {
      const res = await postPowerup(item.tournamentId, item.payload)
      if (res.ok) {
        let body: unknown = null
        try { body = await res.json() } catch { /* noop */ }
        removeById(item.id)
        handlers.onPowerupSuccess?.(item.payload, body)
        return
      }
      if (res.status === 400) {
        // Inspect body — "Powerup already used" means a prior attempt succeeded
        // server-side; treat as terminal success.
        let errMsg = ''
        try { const j = await res.json(); errMsg = String(j?.error ?? '') } catch { /* noop */ }
        if (/already used/i.test(errMsg)) {
          removeById(item.id)
          handlers.onPowerupAlreadyUsed?.(item.payload)
          return
        }
        // Other 400: validation — drop
        console.error('[offline-queue] powerup POST dropped (terminal):', errMsg, item.payload)
        removeById(item.id)
        handlers.onPowerupTerminalFailure?.(item.payload, errMsg || `HTTP 400`)
        return
      }
      if (res.status === 401 || res.status === 403) {
        reschedule(item.id)
        stop()
        return
      }
      if (res.status >= 400 && res.status < 500) {
        let msg = `HTTP ${res.status}`
        try { const j = await res.json(); if (j?.error) msg = String(j.error) } catch { /* noop */ }
        console.error('[offline-queue] powerup POST dropped (terminal):', msg, item.payload)
        removeById(item.id)
        handlers.onPowerupTerminalFailure?.(item.payload, msg)
        return
      }
      reschedule(item.id)
    } catch {
      reschedule(item.id)
    }
  }

  async function doDrain(): Promise<void> {
    while (true) {
      const item = findReadyItem()
      if (!item) break
      if (item.kind === 'score') {
        await processScore(item)
      } else {
        await processPowerup(item)
      }
      // If the item is still present (i.e. it was rescheduled), bail out so
      // we don't busy-loop. The interval / next trigger will pick it up.
      if (queue.some((m) => m.id === item.id)) break
    }
  }

  function drain(): Promise<void> {
    // Coalesce concurrent calls onto a single in-flight drain so the second
    // caller's await actually waits for the first to finish.
    if (drainPromise) return drainPromise
    drainPromise = doDrain().finally(() => { drainPromise = null })
    return drainPromise
  }

  function start(): void {
    if (started) return
    started = true
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }
    intervalId = setInterval(() => { void drain() }, INTERVAL_MS)
    void drain()
  }

  function stop(): void {
    if (!started) return
    started = false
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
    }
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  return {
    enqueueScore,
    enqueuePowerupActivate,
    drain,
    start,
    stop,
    size: () => queue.length,
    snapshot: () => queue.map((m) => ({ ...m })),
  }
}
