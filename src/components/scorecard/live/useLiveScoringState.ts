'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  isValidPutts,
  computeGir,
  canToggleGirOn,
  clampPutts,
} from './score-validation'
import type { VariablePowerupState, PowerupMessage } from './VariablePowerupBanner'
import type { PowerupEffect } from '@/lib/powerup-engine'
import {
  createOfflineQueue,
  type OfflineQueue,
  type PowerupActivatePayload,
  type ScoreMutationPayload,
  type ScoreSuccessResponse,
} from '@/lib/offline-queue'

export interface PowerupActivationCallbacks {
  onSuccess?: (response: unknown) => void
  onAlreadyUsed?: () => void
  onTerminalFailure?: (error: string) => void
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HoleData {
  id: string
  number: number
  par: number
  handicap: number | null
  yards: number | null
}

export interface ExistingScore {
  holeId: string
  strokes: number
  fairwayHit: boolean | null
  gir: boolean | null
  putts: number | null
  conceded?: boolean
}

export interface ActivePowerup {
  playerPowerupId: string
  powerupName: string
  powerupSlug: string
  powerupType: 'BOOST' | 'ATTACK'
  scoreModifier: number | null
  description: string
  /** Full card definition — present when hydrated from the server load.
   *  Optional so legacy / locally-added rows still type-check; the detail
   *  dialog falls back to an inline-rendered minimal card when absent. */
  powerup?: {
    id: string
    slug: string
    name: string
    type: 'BOOST' | 'ATTACK'
    description: string
    effect: PowerupEffect
  }
}

export interface HoleScore {
  strokes: number | null
  putts: number | null
  fairwayHit: boolean | null
  gir: boolean | null
  conceded: boolean
  powerupUsed: boolean
  activePowerups: ActivePowerup[]
  attacksReceived: ActivePowerup[]
  isDirty: boolean
  isSaving: boolean
  isExisting: boolean
}

export type RejectionField = 'putts' | 'gir' | 'fairway' | 'strokes' | null

export interface LiveScoringState {
  currentHoleIndex: number
  scores: Record<string, HoleScore>
  rejection: { field: RejectionField; ts: number } | null
  saveStatus: 'idle' | 'saving' | 'saved'
}

interface UseLiveScoringOpts {
  tournamentPlayerId: string
  roundId: string
  holes: HoleData[]
  existingScores: ExistingScore[]
}

/** Extract progress fields from an in_progress evaluation result */
function parseProgressMetadata(eval_: { slug: string; message: string }): Record<string, unknown> {
  // Parse the message to extract current counts (e.g., "3/5 fairways")
  if (eval_.slug === 'fairway-finder') {
    const match = eval_.message.match(/(\d+)\/(\d+)/)
    if (match) return { fairwaysHit: parseInt(match[1], 10), declaredCount: parseInt(match[2], 10) }
  }
  if (eval_.slug === 'king-of-the-hill') {
    const match = eval_.message.match(/(\d+) hole/)
    if (match) return { consecutiveWins: parseInt(match[1], 10) }
  }
  return {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveScoringState({
  tournamentPlayerId,
  roundId,
  holes,
  existingScores,
}: UseLiveScoringOpts) {
  const sorted = [...holes].sort((a, b) => a.number - b.number)

  // Build initial scores from existing data
  const [scores, setScores] = useState<Record<string, HoleScore>>(() => {
    const m: Record<string, HoleScore> = {}
    for (const h of sorted) {
      const ex = existingScores.find((s) => s.holeId === h.id)
      m[h.id] = ex
        ? {
            strokes: ex.strokes,
            putts: ex.putts,
            fairwayHit: ex.fairwayHit,
            gir: ex.gir,
            conceded: ex.conceded ?? false,
            powerupUsed: false,
            activePowerups: [],
            attacksReceived: [],
            isDirty: false,
            isSaving: false,
            isExisting: true,
          }
        : {
            strokes: null,
            putts: null,
            fairwayHit: null,
            gir: null,
            conceded: false,
            powerupUsed: false,
            activePowerups: [],
            attacksReceived: [],
            isDirty: false,
            isSaving: false,
            isExisting: false,
          }
    }
    return m
  })

  // Determine initial hole: first unscored, or localStorage value
  const [currentHoleIndex, setCurrentHoleIndex] = useState(() => {
    const storageKey = `live-scoring-${roundId}-hole`
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) {
        const idx = parseInt(stored, 10)
        if (!isNaN(idx) && idx >= 0 && idx < sorted.length) return idx
      }
    } catch {
      // SSR or localStorage unavailable
    }
    const firstUnscored = sorted.findIndex(
      (h) => !existingScores.some((s) => s.holeId === h.id),
    )
    return firstUnscored === -1 ? 0 : firstUnscored
  })

  const [rejection, setRejection] = useState<{
    field: RejectionField
    ts: number
  } | null>(null)
  // 'pending' fires the instant a score is dirty so the user sees acknowledgement
  // immediately, before the 600ms save-debounce fires. The lifecycle is:
  // pending → saving → saved → idle.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>(
    'idle',
  )
  const [activeVariablePowerups, setActiveVariablePowerups] = useState<VariablePowerupState[]>([])
  const [powerupMessage, setPowerupMessage] = useState<PowerupMessage | null>(null)
  const powerupMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep a ref to scores so saveHole always reads the latest value
  const scoresRef = useRef(scores)
  useEffect(() => {
    scoresRef.current = scores
  }, [scores])

  // Persist current hole to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        `live-scoring-${roundId}-hole`,
        String(currentHoleIndex),
      )
    } catch {
      // ignore
    }
  }, [currentHoleIndex, roundId])

  // ─── Save logic ───────────────────────────────────────────────────────────
  //
  // All mutating writes (score, concede, powerup activation) flow through the
  // offline queue (`src/lib/offline-queue.ts`). The queue persists to
  // localStorage and retries on `online` / visibility / a 10s interval, so a
  // phone with spotty signal won't silently drop a save.

  const handleScoreSuccess = useCallback(
    (payload: ScoreMutationPayload, response: ScoreSuccessResponse) => {
      const holeId = payload.holeId

      // Process variable powerup evaluation results from the server response
      const evals = response.powerupEvaluations
      if (Array.isArray(evals)) {
        for (const eval_ of evals as Array<{
          playerPowerupId: string
          slug: string
          outcome: string
          message: string
        }>) {
          if (eval_.outcome === 'success' || eval_.outcome === 'failed') {
            setActiveVariablePowerups((prev) =>
              prev.filter((vp) => vp.playerPowerupId !== eval_.playerPowerupId),
            )
            setPowerupMessage({
              playerPowerupId: eval_.playerPowerupId,
              slug: eval_.slug,
              outcome: eval_.outcome as 'success' | 'failed',
              message: eval_.message,
            })
            if (powerupMsgTimer.current) clearTimeout(powerupMsgTimer.current)
            powerupMsgTimer.current = setTimeout(() => setPowerupMessage(null), 5000)
          } else if (eval_.outcome === 'in_progress') {
            setActiveVariablePowerups((prev) =>
              prev.map((vp) =>
                vp.playerPowerupId === eval_.playerPowerupId
                  ? { ...vp, metadata: { ...vp.metadata, ...parseProgressMetadata(eval_) } }
                  : vp,
              ),
            )
          }
        }
      }

      setScores((prev) => {
        if (!prev[holeId]) return prev
        return {
          ...prev,
          [holeId]: {
            ...prev[holeId],
            isDirty: false,
            isSaving: false,
            isExisting: true,
          },
        }
      })
      setSaveStatus('saved')
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
      saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
    },
    [],
  )

  const handleScoreSettled = useCallback(
    (payload: ScoreMutationPayload, result: { ok: boolean; queued: boolean }) => {
      // For any failed attempt (whether queued for retry or terminal), clear
      // the in-flight visual state. The queue keeps trying invisibly.
      if (result.ok) return
      const holeId = payload.holeId
      setScores((prev) => {
        if (!prev[holeId]) return prev
        return {
          ...prev,
          [holeId]: { ...prev[holeId], isSaving: false },
        }
      })
      setSaveStatus('idle')
    },
    [],
  )

  // Per-call callbacks for powerup activations, keyed by playerPowerupId.
  // Set when the consumer enqueues an activation; cleared when the queue
  // resolves the entry.
  const powerupCallbacks = useRef(new Map<string, PowerupActivationCallbacks>())

  // Queue lifecycle is managed in an effect so the queue's handler closures
  // (which read `powerupCallbacks.current`) aren't constructed during render.
  // Mutating callers route through `queueRef.current` — null only on the very
  // first render before the effect mounts, which is fine because score input
  // can't happen until the user interacts after mount.
  const queueRef = useRef<OfflineQueue | null>(null)

  useEffect(() => {
    const q = createOfflineQueue(roundId, {
      onScoreSuccess: handleScoreSuccess,
      onScoreSettled: handleScoreSettled,
      onPowerupSuccess: (payload, response) => {
        const cb = powerupCallbacks.current.get(payload.playerPowerupId)
        powerupCallbacks.current.delete(payload.playerPowerupId)
        cb?.onSuccess?.(response)
      },
      onPowerupAlreadyUsed: (payload) => {
        const cb = powerupCallbacks.current.get(payload.playerPowerupId)
        powerupCallbacks.current.delete(payload.playerPowerupId)
        cb?.onAlreadyUsed?.()
      },
      onPowerupTerminalFailure: (payload, error) => {
        const cb = powerupCallbacks.current.get(payload.playerPowerupId)
        powerupCallbacks.current.delete(payload.playerPowerupId)
        cb?.onTerminalFailure?.(error)
      },
    })
    queueRef.current = q
    q.start()
    return () => {
      q.stop()
      queueRef.current = null
    }
  }, [roundId, handleScoreSuccess, handleScoreSettled])

  const saveHole = useCallback(
    async (holeId: string) => {
      const score = scoresRef.current[holeId]
      if (!score || score.strokes === null || score.strokes < 1) return
      if (!score.isDirty) return

      setScores((prev) => ({
        ...prev,
        [holeId]: { ...prev[holeId], isSaving: true },
      }))
      setSaveStatus('saving')

      const q = queueRef.current
      if (!q) return
      q.enqueueScore({
        tournamentPlayerId,
        holeId,
        roundId,
        strokes: score.strokes,
        fairwayHit: score.fairwayHit,
        gir: score.gir,
        putts: score.putts,
      })
      await q.drain()
    },
    [tournamentPlayerId, roundId],
  )

  // Debounced auto-save. 600ms is the sweet spot — short enough that the
  // "Saving..." indicator appears before users feel uncertainty (research:
  // 1s is the threshold for losing flow), long enough to coalesce rapid
  // +/- taps into a single POST.
  const scheduleSave = useCallback(
    (holeId: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        saveHole(holeId)
      }, 600)
    },
    [saveHole],
  )

  const flushSave = useCallback(
    async (holeId: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = null
      }
      await saveHole(holeId)
    },
    [saveHole],
  )

  // ─── Concede hole (match-play only) ──────────────────────────────────────
  // Bypasses the 1.5s debounce — concession is decisive and should hit the
  // server immediately so the leaderboard reflects the lost hole.
  const concedeHole = useCallback(
    async (holeId: string) => {
      setScores((prev) => ({
        ...prev,
        [holeId]: {
          ...prev[holeId],
          conceded: true,
          strokes: 0,
          isSaving: true,
          isDirty: false,
        },
      }))
      setSaveStatus('saving')
      const q = queueRef.current
      if (!q) return
      q.enqueueScore({
        tournamentPlayerId,
        holeId,
        roundId,
        strokes: 0,
        conceded: true,
        fairwayHit: null,
        gir: null,
        putts: null,
      })
      await q.drain()
    },
    [tournamentPlayerId, roundId],
  )

  // ─── Powerup activation (routes through the offline queue) ───────────────
  // The caller passes per-activation callbacks because the success branch
  // needs to update component-level state (hand state, active variable list,
  // per-hole active list) that the hook can't know about generically.
  const enqueuePowerupActivation = useCallback(
    (tournamentId: string, payload: PowerupActivatePayload, callbacks: PowerupActivationCallbacks) => {
      const q = queueRef.current
      if (!q) return
      powerupCallbacks.current.set(payload.playerPowerupId, callbacks)
      q.enqueuePowerupActivate(tournamentId, payload)
      void q.drain()
    },
    [],
  )

  // ─── Rejection trigger ───────────────────────────────────────────────────

  const triggerRejection = useCallback((field: RejectionField) => {
    setRejection({ field, ts: Date.now() })
  }, [])

  // ─── Score updaters ───────────────────────────────────────────────────────

  const currentHole = sorted[currentHoleIndex]

  const updateScore = useCallback(
    (holeId: string, updater: (prev: HoleScore) => HoleScore) => {
      setScores((prev) => {
        const updated = updater(prev[holeId])
        return { ...prev, [holeId]: { ...updated, isDirty: true } }
      })
      // Show acknowledgement immediately — don't wait for the debounce.
      setSaveStatus('pending')
      scheduleSave(holeId)
    },
    [scheduleSave],
  )

  const incrementStrokes = useCallback(() => {
    if (!currentHole) return
    updateScore(currentHole.id, (prev) => {
      // Cap live-scoring strokes at 15 to prevent runaway tap-ups; admin and
      // post-round entry paths still allow up to 20 for rare blow-up holes.
      // If the hole was previously conceded, re-entering strokes implicitly
      // unconcedes it.
      const fromConceded = prev.conceded
      const newStrokes =
        prev.strokes === null || fromConceded
          ? currentHole.par
          : Math.min(15, prev.strokes + 1)
      const newPutts = prev.putts // putts stay valid when strokes increase
      const newGir = computeGir(newStrokes, newPutts, currentHole.par)
      return { ...prev, strokes: newStrokes, gir: newGir, conceded: false }
    })
  }, [currentHole, updateScore])

  const decrementStrokes = useCallback(() => {
    if (!currentHole) return
    updateScore(currentHole.id, (prev) => {
      const fromConceded = prev.conceded
      const newStrokes =
        prev.strokes === null || fromConceded
          ? currentHole.par
          : Math.max(1, prev.strokes - 1)
      if (newStrokes < 1) return prev
      const newPutts = clampPutts(prev.putts, newStrokes)
      const newGir = computeGir(newStrokes, newPutts, currentHole.par)
      return { ...prev, strokes: newStrokes, putts: newPutts, gir: newGir, conceded: false }
    })
  }, [currentHole, updateScore])

  const incrementPutts = useCallback(() => {
    if (!currentHole) return
    const score = scores[currentHole.id]
    const currentPutts = score.putts ?? 0
    const newPutts = score.putts === null ? 1 : currentPutts + 1
    if (!isValidPutts(newPutts, score.strokes)) {
      triggerRejection('putts')
      return
    }
    updateScore(currentHole.id, (prev) => {
      const newGir = computeGir(prev.strokes, newPutts, currentHole.par)
      return { ...prev, putts: newPutts, gir: newGir }
    })
  }, [currentHole, scores, updateScore, triggerRejection])

  const decrementPutts = useCallback(() => {
    if (!currentHole) return
    const score = scores[currentHole.id]
    const newPutts =
      score.putts === null ? 0 : Math.max(0, score.putts - 1)
    updateScore(currentHole.id, (prev) => {
      const newGir = computeGir(prev.strokes, newPutts, currentHole.par)
      return { ...prev, putts: newPutts, gir: newGir }
    })
  }, [currentHole, scores, updateScore])

  const toggleFairwayHit = useCallback(() => {
    if (!currentHole) return
    updateScore(currentHole.id, (prev) => ({
      ...prev,
      fairwayHit: prev.fairwayHit ? false : true,
    }))
  }, [currentHole, updateScore])

  const toggleGir = useCallback(() => {
    if (!currentHole) return
    const score = scores[currentHole.id]
    // If currently ON, allow toggling OFF (manual override)
    if (score.gir === true) {
      updateScore(currentHole.id, (prev) => ({ ...prev, gir: false }))
      return
    }
    // If trying to toggle ON, check the math
    if (!canToggleGirOn(score.strokes, score.putts, currentHole.par)) {
      triggerRejection('gir')
      return
    }
    updateScore(currentHole.id, (prev) => ({ ...prev, gir: true }))
  }, [currentHole, scores, updateScore, triggerRejection])

  const togglePowerup = useCallback(() => {
    if (!currentHole) return
    updateScore(currentHole.id, (prev) => ({
      ...prev,
      powerupUsed: !prev.powerupUsed,
    }))
  }, [currentHole, updateScore])

  const addActivePowerup = useCallback(
    (holeId: string, powerup: ActivePowerup) => {
      setScores((prev) => {
        const existing = prev[holeId].activePowerups
        // Don't add duplicates
        if (existing.some((p) => p.playerPowerupId === powerup.playerPowerupId)) return prev
        return {
          ...prev,
          [holeId]: {
            ...prev[holeId],
            activePowerups: [...existing, powerup],
            powerupUsed: true,
            isDirty: true,
          },
        }
      })
      scheduleSave(holeId)
    },
    [scheduleSave],
  )

  const removeActivePowerup = useCallback(
    (holeId: string, playerPowerupId: string) => {
      setScores((prev) => {
        const remaining = prev[holeId].activePowerups.filter(
          (p) => p.playerPowerupId !== playerPowerupId,
        )
        return {
          ...prev,
          [holeId]: {
            ...prev[holeId],
            activePowerups: remaining,
            powerupUsed: remaining.length > 0,
            isDirty: true,
          },
        }
      })
      scheduleSave(holeId)
    },
    [scheduleSave],
  )

  const addAttackReceived = useCallback(
    (holeId: string, attack: ActivePowerup) => {
      setScores((prev) => {
        const existing = prev[holeId].attacksReceived
        if (existing.some((a) => a.playerPowerupId === attack.playerPowerupId)) return prev
        return {
          ...prev,
          [holeId]: {
            ...prev[holeId],
            attacksReceived: [...existing, attack],
          },
        }
      })
    },
    [],
  )

  // ─── Variable Powerup State ────────────────────────────────────────────────

  const addActiveVariablePowerup = useCallback(
    (powerup: VariablePowerupState) => {
      setActiveVariablePowerups((prev) => {
        if (prev.some((vp) => vp.playerPowerupId === powerup.playerPowerupId)) return prev
        return [...prev, powerup]
      })
    },
    [],
  )

  const clearPowerupMessage = useCallback(() => {
    setPowerupMessage(null)
  }, [])

  // ─── Navigation ───────────────────────────────────────────────────────────

  const navigateToHole = useCallback(
    async (index: number) => {
      if (index < 0 || index >= sorted.length) return
      // Auto-save current hole before navigating — wait for it to complete
      if (currentHole) await flushSave(currentHole.id)
      setCurrentHoleIndex(index)
    },
    [sorted.length, currentHole, flushSave],
  )

  const nextHole = useCallback(() => {
    navigateToHole(currentHoleIndex + 1)
  }, [currentHoleIndex, navigateToHole])

  const prevHole = useCallback(() => {
    navigateToHole(currentHoleIndex - 1)
  }, [currentHoleIndex, navigateToHole])

  // ─── Computed values ──────────────────────────────────────────────────────

  const getRunningScore = useCallback(() => {
    let totalStrokes = 0
    let totalPar = 0
    let holesPlayed = 0

    for (const h of sorted) {
      const s = scores[h.id]
      if (s && s.strokes !== null) {
        totalStrokes += s.strokes
        totalPar += h.par
        holesPlayed++
      }
    }

    const diff = holesPlayed > 0 ? totalStrokes - totalPar : null
    return { totalStrokes, totalPar, holesPlayed, diff }
  }, [sorted, scores])

  return {
    // State
    currentHoleIndex,
    currentHole,
    scores,
    rejection,
    saveStatus,
    sortedHoles: sorted,

    // Score actions
    incrementStrokes,
    decrementStrokes,
    incrementPutts,
    decrementPutts,
    toggleFairwayHit,
    toggleGir,
    togglePowerup,
    addActivePowerup,
    removeActivePowerup,
    addAttackReceived,

    // Variable powerup state
    activeVariablePowerups,
    powerupMessage,
    addActiveVariablePowerup,
    clearPowerupMessage,

    // Navigation
    navigateToHole,
    nextHole,
    prevHole,

    // Computed
    getRunningScore,

    // Save
    flushSave,
    concedeHole,
    enqueuePowerupActivation,
  }
}
