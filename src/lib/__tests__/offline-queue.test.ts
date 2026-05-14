import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createOfflineQueue, type ScoreMutationPayload, type PowerupActivatePayload } from '@/lib/offline-queue'

function makeStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    _raw: store,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function networkError(): Promise<Response> {
  return Promise.reject(new Error('network down'))
}

const scorePayload: ScoreMutationPayload = {
  tournamentPlayerId: 'tp1',
  holeId: 'h1',
  roundId: 'r1',
  strokes: 4,
  fairwayHit: true,
  gir: true,
  putts: 2,
}

const powerupPayload: PowerupActivatePayload = {
  playerPowerupId: 'pp1',
  roundId: 'r1',
  holeNumber: 5,
}

describe('offline-queue', () => {
  let storage: ReturnType<typeof makeStorage>

  beforeEach(() => {
    storage = makeStorage()
  })

  describe('enqueueScore', () => {
    it('persists the score mutation to storage', () => {
      const q = createOfflineQueue('r1', {}, {
        storage,
        fetchFn: vi.fn().mockResolvedValue(jsonResponse(200, {})),
      })
      q.enqueueScore(scorePayload)
      expect(storage._raw.get('offline-queue:r1')).toBeTruthy()
      const parsed = JSON.parse(storage._raw.get('offline-queue:r1')!)
      expect(parsed[0].kind).toBe('score')
      expect(parsed[0].payload).toEqual(scorePayload)
    })
  })

  describe('drain - score success', () => {
    it('removes the item and calls onScoreSuccess on 200', async () => {
      const onScoreSuccess = vi.fn()
      const onScoreSettled = vi.fn()
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { id: 'created', powerupEvaluations: [] }))

      const q = createOfflineQueue('r1', { onScoreSuccess, onScoreSettled }, { storage, fetchFn })
      q.enqueueScore(scorePayload)
      await q.drain()

      expect(fetchFn).toHaveBeenCalledWith('/api/scores', expect.objectContaining({ method: 'POST' }))
      expect(q.size()).toBe(0)
      expect(onScoreSuccess).toHaveBeenCalledWith(scorePayload, expect.objectContaining({ id: 'created' }))
      expect(onScoreSettled).toHaveBeenCalledWith(scorePayload, { ok: true, queued: false })
      expect(storage._raw.get('offline-queue:r1')).toBeUndefined()
    })
  })

  describe('drain - score transient failure', () => {
    it('keeps the item queued and increments attempts on network error', async () => {
      const onScoreSettled = vi.fn()
      const fetchFn = vi.fn().mockImplementation(networkError)

      const q = createOfflineQueue('r1', { onScoreSettled }, { storage, fetchFn })
      q.enqueueScore(scorePayload)
      await q.drain()

      expect(q.size()).toBe(1)
      expect(q.snapshot()[0].attempts).toBe(1)
      expect(onScoreSettled).toHaveBeenCalledWith(scorePayload, { ok: false, queued: true })
    })

    it('keeps the item queued on 500', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'oops' }))
      const q = createOfflineQueue('r1', {}, { storage, fetchFn })
      q.enqueueScore(scorePayload)
      await q.drain()
      expect(q.size()).toBe(1)
      expect(q.snapshot()[0].attempts).toBe(1)
    })
  })

  describe('drain - score terminal failure', () => {
    it('drops the item on 400 validation error', async () => {
      const onScoreSettled = vi.fn()
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'Strokes must be 1-20' }))
      const q = createOfflineQueue('r1', { onScoreSettled }, { storage, fetchFn })
      q.enqueueScore(scorePayload)
      await q.drain()
      expect(q.size()).toBe(0)
      expect(onScoreSettled).toHaveBeenCalledWith(scorePayload, { ok: false, queued: false })
    })
  })

  describe('drain - retry succeeds after transient failure', () => {
    it('eventually drains when fetch starts succeeding', async () => {
      const onScoreSuccess = vi.fn()
      let calls = 0
      const fetchFn = vi.fn().mockImplementation(() => {
        calls += 1
        if (calls === 1) return networkError()
        return Promise.resolve(jsonResponse(200, {}))
      })

      let t = 1_000
      const q = createOfflineQueue('r1', { onScoreSuccess }, {
        storage,
        fetchFn,
        now: () => t,
      })
      q.enqueueScore(scorePayload)
      await q.drain()
      expect(q.size()).toBe(1) // first attempt failed; queued for retry

      // Advance time past the first backoff (1s)
      t += 2_000
      await q.drain()

      expect(q.size()).toBe(0)
      expect(onScoreSuccess).toHaveBeenCalledTimes(1)
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('drain - respects per-item backoff', () => {
    it('does not retry an item whose nextAttemptAt is in the future', async () => {
      const fetchFn = vi.fn().mockImplementation(networkError)
      const t = 1_000
      const q = createOfflineQueue('r1', {}, { storage, fetchFn, now: () => t })
      q.enqueueScore(scorePayload)
      await q.drain()
      expect(fetchFn).toHaveBeenCalledTimes(1)
      // Without advancing time, drain should NOT retry (backoff 1s not elapsed)
      await q.drain()
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('drain - powerup "already used"', () => {
    it('treats 400 "Powerup already used" as terminal success', async () => {
      const onPowerupAlreadyUsed = vi.fn()
      const onPowerupSuccess = vi.fn()
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'Powerup already used' }))

      const q = createOfflineQueue('r1', { onPowerupAlreadyUsed, onPowerupSuccess }, { storage, fetchFn })
      q.enqueuePowerupActivate('tour1', powerupPayload)
      await q.drain()

      expect(q.size()).toBe(0)
      expect(onPowerupAlreadyUsed).toHaveBeenCalledWith(powerupPayload)
      expect(onPowerupSuccess).not.toHaveBeenCalled()
    })

    it('calls onPowerupSuccess on 200', async () => {
      const onPowerupSuccess = vi.fn()
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { id: 'pp1', status: 'USED' }))

      const q = createOfflineQueue('r1', { onPowerupSuccess }, { storage, fetchFn })
      q.enqueuePowerupActivate('tour1', powerupPayload)
      await q.drain()

      expect(q.size()).toBe(0)
      expect(onPowerupSuccess).toHaveBeenCalledWith(powerupPayload, expect.objectContaining({ id: 'pp1' }))
    })

    it('drops on terminal 400 that is NOT "already used"', async () => {
      const onPowerupTerminalFailure = vi.fn()
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'Target player required for attack cards' }))

      const q = createOfflineQueue('r1', { onPowerupTerminalFailure }, { storage, fetchFn })
      q.enqueuePowerupActivate('tour1', powerupPayload)
      await q.drain()

      expect(q.size()).toBe(0)
      expect(onPowerupTerminalFailure).toHaveBeenCalledWith(powerupPayload, expect.stringContaining('Target player required'))
    })

    it('retries on network error', async () => {
      const fetchFn = vi.fn().mockImplementation(networkError)
      const q = createOfflineQueue('r1', {}, { storage, fetchFn })
      q.enqueuePowerupActivate('tour1', powerupPayload)
      await q.drain()
      expect(q.size()).toBe(1)
      expect(q.snapshot()[0].attempts).toBe(1)
    })
  })

  describe('persistence across instances (reload simulation)', () => {
    it('restores queued items on construction', async () => {
      // First instance: enqueue and fail
      const fetchFn1 = vi.fn().mockImplementation(networkError)
      const q1 = createOfflineQueue('r1', {}, { storage, fetchFn: fetchFn1 })
      q1.enqueueScore(scorePayload)
      await q1.drain()
      expect(q1.size()).toBe(1)

      // Simulate reload: fresh instance, same storage
      const onScoreSuccess = vi.fn()
      const fetchFn2 = vi.fn().mockResolvedValue(jsonResponse(200, {}))
      const t = Date.now() + 60_000  // past the backoff window
      const q2 = createOfflineQueue('r1', { onScoreSuccess }, { storage, fetchFn: fetchFn2, now: () => t })

      expect(q2.size()).toBe(1)
      await q2.drain()
      expect(q2.size()).toBe(0)
      expect(onScoreSuccess).toHaveBeenCalledWith(scorePayload, {})
    })

    it('prunes entries older than 24h on load', () => {
      // Manually seed storage with a stale entry
      const stale = [{
        kind: 'score',
        id: 'old',
        payload: scorePayload,
        attempts: 0,
        nextAttemptAt: 0,
        createdAt: 100,  // ancient
      }]
      storage.setItem('offline-queue:r1', JSON.stringify(stale))

      const q = createOfflineQueue('r1', {}, {
        storage,
        fetchFn: vi.fn().mockResolvedValue(jsonResponse(200, {})),
        now: () => 100 + 25 * 60 * 60 * 1_000,  // 25h later
      })
      expect(q.size()).toBe(0)
    })
  })

  describe('drain reentrance', () => {
    it('does not start a second concurrent drain', async () => {
      let resolve!: (r: Response) => void
      const fetchFn = vi.fn().mockImplementation(() => new Promise<Response>((r) => { resolve = r }))
      const q = createOfflineQueue('r1', {}, { storage, fetchFn })
      q.enqueueScore(scorePayload)
      // enqueueScore already kicked off one drain; calling drain again should be a no-op
      const second = q.drain()
      expect(fetchFn).toHaveBeenCalledTimes(1)
      resolve(jsonResponse(200, {}))
      await second
    })
  })
})
