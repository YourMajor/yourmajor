'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  maxPutts,
  isValidPutts,
  computeGir,
  canToggleGirOn,
  clampPutts,
} from './score-validation'
import type { VariablePowerupState, PowerupMessage } from './VariablePowerupBanner'

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
}

export interface ActivePowerup {
  playerPowerupId: string
  powerupName: string
  powerupSlug: string
  powerupType: 'BOOST' | 'ATTACK'
  scoreModifier: number | null
  description: string
}

export interface HoleScore {
  strokes: number | null
  putts: number | null
  fairwayHit: boolean | null
  gir: boolean | null
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
  apiEndpoint?: string // defaults to '/api/scores'
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
  apiEndpoint = '/api/scores',
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )
  const [activeVariablePowerups, setActiveVariablePowerups] = useState<VariablePowerupState[]>([])
  const [powerupMessage, setPowerupMessage] = useState<PowerupMessage | null>(null)
  const powerupMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep a ref to scores so saveHole always reads the latest value
  const scoresRef = useRef(scores)
  scoresRef.current = scores

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

  const saveHole = useCallback(
    async (holeId: string) => {
      // Read from ref to avoid stale closure
      const score = scoresRef.current[holeId]
      if (!score || score.strokes === null || score.strokes < 1) return
      if (!score.isDirty) return

      setScores((prev) => ({
        ...prev,
        [holeId]: { ...prev[holeId], isSaving: true },
      }))
      setSaveStatus('saving')

      try {
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tournamentPlayerId,
            holeId,
            roundId,
            strokes: score.strokes,
            fairwayHit: score.fairwayHit,
            gir: score.gir,
            putts: score.putts,
          }),
        })
        const data = await res.json()

        // Process variable powerup evaluation results
        if (data.powerupEvaluations && Array.isArray(data.powerupEvaluations)) {
          for (const eval_ of data.powerupEvaluations) {
            if (eval_.outcome === 'success' || eval_.outcome === 'failed') {
              // Remove from active list
              setActiveVariablePowerups((prev) =>
                prev.filter((vp) => vp.playerPowerupId !== eval_.playerPowerupId),
              )
              // Show toast message
              setPowerupMessage({
                playerPowerupId: eval_.playerPowerupId,
                slug: eval_.slug,
                outcome: eval_.outcome,
                message: eval_.message,
              })
              if (powerupMsgTimer.current) clearTimeout(powerupMsgTimer.current)
              powerupMsgTimer.current = setTimeout(() => setPowerupMessage(null), 5000)
            } else if (eval_.outcome === 'in_progress') {
              // Update metadata in active list
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

        setScores((prev) => ({
          ...prev,
          [holeId]: {
            ...prev[holeId],
            isDirty: false,
            isSaving: false,
            isExisting: true,
          },
        }))
        setSaveStatus('saved')
        if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
        saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setScores((prev) => ({
          ...prev,
          [holeId]: { ...prev[holeId], isSaving: false },
        }))
        setSaveStatus('idle')
      }
    },
    [tournamentPlayerId, roundId, apiEndpoint],
  )

  // Debounced auto-save: triggers 1.5s after last change
  const scheduleSave = useCallback(
    (holeId: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        saveHole(holeId)
      }, 1500)
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
      scheduleSave(holeId)
    },
    [scheduleSave],
  )

  const incrementStrokes = useCallback(() => {
    if (!currentHole) return
    updateScore(currentHole.id, (prev) => {
      const newStrokes =
        prev.strokes === null ? currentHole.par : prev.strokes + 1
      const newPutts = prev.putts // putts stay valid when strokes increase
      const newGir = computeGir(newStrokes, newPutts, currentHole.par)
      return { ...prev, strokes: newStrokes, gir: newGir }
    })
  }, [currentHole, updateScore])

  const decrementStrokes = useCallback(() => {
    if (!currentHole) return
    updateScore(currentHole.id, (prev) => {
      const newStrokes =
        prev.strokes === null ? currentHole.par : Math.max(1, prev.strokes - 1)
      if (newStrokes < 1) return prev
      const newPutts = clampPutts(prev.putts, newStrokes)
      const newGir = computeGir(newStrokes, newPutts, currentHole.par)
      return { ...prev, strokes: newStrokes, putts: newPutts, gir: newGir }
    })
  }, [currentHole, updateScore])

  const incrementPutts = useCallback(() => {
    if (!currentHole) return
    const score = scores[currentHole.id]
    const currentPutts = score.putts ?? 1 // first tap goes to 2
    const newPutts = score.putts === null ? 2 : currentPutts + 1
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
      score.putts === null ? 2 : Math.max(0, score.putts - 1)
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
  }
}
