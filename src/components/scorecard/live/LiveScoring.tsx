'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useLiveScoringState } from './useLiveScoringState'
import { HoleNavigator } from './HoleNavigator'
import { HoleScoring } from './HoleScoring'
import { HoleOverview } from './HoleOverview'
import { RoundSummary } from './RoundSummary'
import { PendingConfirmationModal, type PendingConfirmation } from './PendingConfirmationModal'
import type { HoleData, ExistingScore } from './useLiveScoringState'
import type { PlayerPowerupData } from './PowerupTray'
import type { PowerupEffect } from '@/lib/powerup-engine'
import { isVariablePowerup } from '@/lib/powerup-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveScoringProps {
  tournamentPlayerId: string
  roundId: string
  holes: HoleData[]
  existingScores: ExistingScore[]
  courseName: string
  powerupsEnabled?: boolean
  teeName?: string
  teeColor?: string
  primaryColor?: string
  accentColor?: string
  courseLatitude?: number | null
  courseLongitude?: number | null
  backHref?: string // link back to tournament hub (e.g. "/my-tournament")
  backLabel?: string // label for back link (e.g. "Tournament")
  playerName?: string // current player's display name for scorecard
  tournamentId?: string // enables chat panel when provided
  playerPowerups?: Array<{
    id: string
    powerupId: string
    status: string
    holeNumber: number | null
    targetHoleNumber: number | null
    roundId: string | null
    scoreModifier: number | null
    metadata?: Record<string, unknown>
    powerup: {
      id: string
      slug: string
      name: string
      type: 'BOOST' | 'ATTACK'
      description: string
      effect: PowerupEffect
    }
  }>
  attacksReceived?: Array<{
    id: string
    holeNumber: number | null
    targetHoleNumber: number | null
    scoreModifier: number | null
    powerup: {
      id: string
      slug: string
      name: string
      type: 'BOOST' | 'ATTACK'
      description: string
      effect: PowerupEffect
    }
    tournamentPlayer: { user: { name: string | null } }
  }>
  tournamentPlayers?: Array<{
    id: string
    user: { name: string | null }
  }>
  /** Map of opponent tournamentPlayerId → list of hole numbers they've scored
   *  on the current round. Used by the activation dialog to compute the next
   *  valid attack hole on each opponent. */
  opponentScoredHoles?: Record<string, number[]>
}

// ─── Swipe Panel Indices ──────────────────────────────────────────────────────
// -1 = HoleOverview (left), 0 = HoleScoring (center), 1 = RoundSummary (right)

const SWIPE_THRESHOLD = 50

export function LiveScoring({
  tournamentPlayerId,
  roundId,
  holes,
  existingScores,
  courseName,
  powerupsEnabled = false,
  teeName,
  teeColor,
  courseLatitude,
  courseLongitude,
  primaryColor,
  accentColor,
  backHref,
  backLabel = 'Tournament',
  playerName,
  tournamentId,
  playerPowerups: rawPlayerPowerups = [],
  attacksReceived: rawAttacksReceived = [],
  tournamentPlayers: rawTournamentPlayers = [],
  opponentScoredHoles = {},
}: LiveScoringProps) {
  const router = useRouter()

  const state = useLiveScoringState({
    tournamentPlayerId,
    roundId,
    holes,
    existingScores,
  })

  const [finishError, setFinishError] = useState<string | null>(null)
  const [usedPowerupIds, setUsedPowerupIds] = useState<Set<string>>(() => {
    // Initialize from any already-used powerups in the server data
    return new Set(rawPlayerPowerups.filter((pp) => pp.status === 'USED').map((pp) => pp.id))
  })

  // ─── Pending powerup confirmations (Big Brother / Drink Up etc.) ────────
  // These are USED cards whose scoreModifier is null because the trigger needs
  // a Yes/No answer from the activator. We fetch on mount, on tab focus, and
  // after each score save (which is when most BOOST-card holes become eligible).
  // `deferredIds` skips a card the user dismissed this session — it'll re-
  // surface on the next refetch.
  const [pendingQueue, setPendingQueue] = useState<PendingConfirmation[]>([])
  const [deferredIds, setDeferredIds] = useState<Set<string>>(new Set())

  const fetchPendingConfirmations = useCallback(async () => {
    if (!tournamentId || !powerupsEnabled) return
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/powerups/pending-confirmations?roundId=${roundId}`,
      )
      if (!res.ok) return
      const data = (await res.json()) as { pendingConfirmations: PendingConfirmation[] }
      setPendingQueue(data.pendingConfirmations ?? [])
    } catch {
      // Non-critical — they'll re-surface on the next save.
    }
  }, [tournamentId, powerupsEnabled, roundId])

  // Fetch on mount.
  useEffect(() => {
    fetchPendingConfirmations()
  }, [fetchPendingConfirmations])

  // Refetch when a save lands (BOOST cards become eligible the moment the
  // activator's hole gets a score; ATTACK cards become eligible when a target
  // they hit posts a score, so refetching on focus also catches that case).
  useEffect(() => {
    if (state.saveStatus === 'saved') {
      fetchPendingConfirmations()
    }
  }, [state.saveStatus, fetchPendingConfirmations])

  // Refetch on tab focus (covers ATTACK confirmations triggered by an opponent
  // saving while this player isn't actively scoring).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchPendingConfirmations()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchPendingConfirmations])

  const handleAnswerConfirmation = useCallback(
    async (playerPowerupId: string, modifier: number): Promise<boolean> => {
      if (!tournamentId) return false
      const res = await fetch(`/api/tournaments/${tournamentId}/powerups/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerPowerupId, scoreModifier: modifier }),
      })
      if (!res.ok) return false
      setPendingQueue((prev) => prev.filter((p) => p.playerPowerupId !== playerPowerupId))
      return true
    },
    [tournamentId],
  )

  const handleDeferConfirmation = useCallback(() => {
    setPendingQueue((prev) => {
      const [first, ...rest] = prev
      if (first) {
        setDeferredIds((d) => {
          const next = new Set(d)
          next.add(first.playerPowerupId)
          return next
        })
      }
      return rest
    })
  }, [])

  const visibleConfirmation = pendingQueue.find((p) => !deferredIds.has(p.playerPowerupId)) ?? null

  // Transform raw powerup data for components, applying local used state
  const mappedPowerups: PlayerPowerupData[] = rawPlayerPowerups.map((pp) => ({
    playerPowerupId: pp.id,
    powerupId: pp.powerup.id,
    slug: pp.powerup.slug,
    name: pp.powerup.name,
    type: pp.powerup.type,
    description: pp.powerup.description,
    effect: pp.powerup.effect as PowerupEffect,
    status: usedPowerupIds.has(pp.id) ? 'USED' as const : pp.status as 'AVAILABLE' | 'ACTIVE' | 'USED',
  }))

  const mappedPlayers = rawTournamentPlayers.map((p) => ({
    id: p.id,
    name: p.user.name ?? 'Player',
  }))

  // Hydrate used powerups, active variable powerups, and attacks on mount
  useEffect(() => {
    // Build hole number → hole id map
    const holeNumToId = new Map<number, string>()
    for (const h of holes) {
      holeNumToId.set(h.number, h.id)
    }

    // Hydrate used powerups (own cards played on this round)
    for (const pp of rawPlayerPowerups) {
      if (pp.status === 'USED' && pp.holeNumber && pp.roundId === roundId) {
        const holeId = holeNumToId.get(pp.holeNumber)
        if (holeId) {
          state.addActivePowerup(holeId, {
            playerPowerupId: pp.id,
            powerupName: pp.powerup.name,
            powerupSlug: pp.powerup.slug,
            powerupType: pp.powerup.type,
            scoreModifier: pp.scoreModifier ?? null,
            description: pp.powerup.description,
            powerup: {
              id: pp.powerup.id,
              slug: pp.powerup.slug,
              name: pp.powerup.name,
              type: pp.powerup.type,
              description: pp.powerup.description,
              effect: pp.powerup.effect as PowerupEffect,
            },
          })
        }
      }
    }

    // Hydrate ACTIVE variable powerups from server data
    for (const pp of rawPlayerPowerups) {
      if (pp.status === 'ACTIVE' && pp.roundId === roundId) {
        state.addActiveVariablePowerup({
          playerPowerupId: pp.id,
          slug: pp.powerup.slug,
          name: pp.powerup.name,
          metadata: (pp.metadata ?? {}) as Record<string, unknown>,
          status: 'ACTIVE',
        })
      }
    }

    // Hydrate attacks received on this round. Prefer targetHoleNumber (the
    // hole on the recipient's scorecard) over holeNumber (the attacker's
    // activation hole), falling back for legacy rows that pre-date the field.
    for (const ar of rawAttacksReceived) {
      const landsOn = ar.targetHoleNumber ?? ar.holeNumber
      if (landsOn) {
        const holeId = holeNumToId.get(landsOn)
        if (holeId) {
          state.addAttackReceived(holeId, {
            playerPowerupId: ar.id,
            powerupName: ar.powerup.name,
            powerupSlug: ar.powerup.slug,
            powerupType: ar.powerup.type,
            scoreModifier: ar.scoreModifier ?? null,
            description: ar.powerup.description,
            powerup: {
              id: ar.powerup.id,
              slug: ar.powerup.slug,
              name: ar.powerup.name,
              type: ar.powerup.type,
              description: ar.powerup.description,
              effect: ar.powerup.effect as PowerupEffect,
            },
          })
        }
      }
    }

    // Also fetch active variable powerups from the dedicated endpoint
    // (handles cases where server data didn't include latest metadata)
    if (tournamentId && powerupsEnabled) {
      fetch(`/api/tournaments/${tournamentId}/powerups/active`)
        .then((res) => res.json())
        .then((data) => {
          if (data.activePowerups) {
            for (const ap of data.activePowerups) {
              if (ap.roundId === roundId) {
                state.addActiveVariablePowerup({
                  playerPowerupId: ap.id,
                  slug: ap.powerup.slug,
                  name: ap.powerup.name,
                  metadata: (ap.metadata ?? {}) as Record<string, unknown>,
                  status: 'ACTIVE',
                })
              }
            }
          }
        })
        .catch(() => {}) // Non-critical
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run once on mount

  const handleActivatePowerup = useCallback(async (data: {
    playerPowerupId: string
    targetPlayerId?: string
    targetHoleNumber?: number
    metadata?: Record<string, unknown>
  }) => {
    if (!state.currentHole || !tournamentId) return

    const res = await fetch(`/api/tournaments/${tournamentId}/powerups/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerPowerupId: data.playerPowerupId,
        roundId,
        holeNumber: state.currentHole.number,
        targetPlayerId: data.targetPlayerId,
        targetHoleNumber: data.targetHoleNumber,
        metadata: data.metadata,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to activate')
    }

    const result = await res.json()
    const powerup = mappedPowerups.find((p) => p.playerPowerupId === data.playerPowerupId)

    if (powerup) {
      const effect = powerup.effect as PowerupEffect

      if (result.status === 'ACTIVE' && isVariablePowerup(effect)) {
        // Variable powerup → add to active variable tracking
        state.addActiveVariablePowerup({
          playerPowerupId: data.playerPowerupId,
          slug: powerup.slug,
          name: powerup.name,
          metadata: (result.metadata ?? {}) as Record<string, unknown>,
          status: 'ACTIVE',
        })
      } else {
        // Regular powerup → add to per-hole active list
        state.addActivePowerup(state.currentHole.id, {
          playerPowerupId: data.playerPowerupId,
          powerupName: powerup.name,
          powerupSlug: powerup.slug,
          powerupType: powerup.type,
          scoreModifier: result.scoreModifier ?? null,
          description: powerup.description,
          powerup: {
            id: powerup.powerupId,
            slug: powerup.slug,
            name: powerup.name,
            type: powerup.type,
            description: powerup.description,
            effect: powerup.effect,
          },
        })
      }
      // Remove from hand by marking as used in local state
      setUsedPowerupIds((prev) => new Set(prev).add(data.playerPowerupId))
    }
  }, [state, tournamentId, roundId, mappedPowerups])

  const handleFinishRound = useCallback(async () => {
    // Check for missing scores
    const missing = state.sortedHoles.filter(
      (h) => !state.scores[h.id] || state.scores[h.id].strokes === null,
    )
    if (missing.length > 0) {
      const holeNumbers = missing.map((h) => h.number).join(', ')
      setFinishError(
        missing.length === 1
          ? `Score missing for hole ${holeNumbers}`
          : `Scores missing for holes ${holeNumbers}`,
      )
      return
    }

    setFinishError(null)
    if (state.currentHole) {
      await state.flushSave(state.currentHole.id)
    }

    // Finalize any remaining active variable powerups
    if (tournamentId && state.activeVariablePowerups.length > 0) {
      try {
        await fetch(`/api/tournaments/${tournamentId}/powerups/finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roundId }),
        })
      } catch {
        // Non-critical — don't block navigation
      }
    }

    if (backHref) {
      router.push(backHref)
    }
  }, [state, backHref, router, tournamentId, roundId])

  const [panelIndex, setPanelIndex] = useState(0) // -1, 0, 1
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ─── Touch handlers for swipe carousel ──────────────────────────────────

  const swipeLockedAxis = useRef<'x' | 'y' | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
    swipeLockedAxis.current = null
  }, [])

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return
      const touch = e.touches[0]
      const dx = touch.clientX - touchStart.current.x
      const dy = touch.clientY - touchStart.current.y

      // Lock axis after initial movement
      if (!swipeLockedAxis.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        swipeLockedAxis.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      }

      // Only handle horizontal swipes
      if (swipeLockedAxis.current !== 'x') return

      // Prevent vertical scroll while swiping horizontally
      e.preventDefault()
      setIsDragging(true)

      // Clamp at edges with rubber-band
      if (panelIndex === -1 && dx > 0) {
        setDragOffset(dx * 0.3)
      } else if (panelIndex === 1 && dx < 0) {
        setDragOffset(dx * 0.3)
      } else {
        setDragOffset(dx)
      }
    },
    [panelIndex],
  )

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current) return
    setIsDragging(false)

    if (swipeLockedAxis.current === 'x' && Math.abs(dragOffset) > SWIPE_THRESHOLD) {
      if (dragOffset > 0 && panelIndex > -1) {
        setPanelIndex((p) => p - 1)
      } else if (dragOffset < 0 && panelIndex < 1) {
        setPanelIndex((p) => p + 1)
      }
    }

    setDragOffset(0)
    touchStart.current = null
    swipeLockedAxis.current = null
  }, [dragOffset, panelIndex])

  // ─── Computed ───────────────────────────────────────────────────────────

  const runningScore = state.getRunningScore()
  const currentScore = state.currentHole
    ? state.scores[state.currentHole.id]
    : null

  // Panel translate
  const baseTranslate = -panelIndex * 100 // in vw
  const dragPx = isDragging ? dragOffset : 0

  // Inline CSS vars for standalone branding
  const rootStyle: Record<string, string> = {}
  if (primaryColor) rootStyle['--color-primary'] = primaryColor
  if (accentColor) rootStyle['--color-accent'] = accentColor

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 w-screen h-[100dvh] z-50 flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--color-primary, oklch(0.40 0.11 160))',
        ...rootStyle,
      }}
    >
      {/* Stacked Yes/No prompt for manual-trigger powerups. */}
      <PendingConfirmationModal
        confirmation={visibleConfirmation}
        onAnswer={handleAnswerConfirmation}
        onDefer={handleDeferConfirmation}
      />

      {/* ── Hole Navigator + Back link (top) ─────────────────────────── */}
      <div className="shrink-0 bg-black/20 flex items-center pt-safe">
        <div
          className="flex-1 overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to right, black 0%, black 75%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black 75%, transparent 100%)',
          }}
        >
          <HoleNavigator
            holes={state.sortedHoles}
            scores={state.scores}
            currentIndex={state.currentHoleIndex}
            onSelect={state.navigateToHole}
          />
        </div>
        {backHref && (
          <Link
            href={backHref}
            className="shrink-0 flex items-center gap-1 px-4 py-3 text-xs font-semibold text-white/80 hover:text-white transition-colors touch-manipulation"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {backLabel}
          </Link>
        )}
      </div>

      {/* ── Swipe Carousel ──────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full"
          style={{
            width: '300vw',
            transform: `translateX(calc(${baseTranslate}vw + ${dragPx}px - 100vw))`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
            touchAction: 'pan-y',
          }}
        >
          {/* Left panel: Hole Overview */}
          <div className="w-screen h-full shrink-0">
            {state.currentHole && (
              <HoleOverview
                hole={state.currentHole}
                teeName={teeName}
                teeColor={teeColor}
                courseLatitude={courseLatitude}
                courseLongitude={courseLongitude}
              />
            )}
          </div>

          {/* Center panel: Scoring */}
          <div className="w-screen h-full shrink-0">
            {state.currentHole && currentScore && (
              <HoleScoring
                hole={state.currentHole}
                score={currentScore}
                teeName={teeName}
                teeColor={teeColor}
                powerupsEnabled={powerupsEnabled}
                playerPowerups={mappedPowerups}
                activePowerups={currentScore?.activePowerups ?? []}
                attacksReceived={currentScore?.attacksReceived ?? []}
                activeVariablePowerups={state.activeVariablePowerups}
                powerupMessage={state.powerupMessage}
                tournamentPlayers={mappedPlayers}
                currentPlayerId={tournamentPlayerId}
                courseHoleNumbers={state.sortedHoles.map((h) => h.number)}
                opponentScoredHoles={opponentScoredHoles}
                rejection={state.rejection}
                saveStatus={state.saveStatus}
                runningScore={runningScore}
                onIncrementStrokes={state.incrementStrokes}
                onDecrementStrokes={state.decrementStrokes}
                onIncrementPutts={state.incrementPutts}
                onDecrementPutts={state.decrementPutts}
                onToggleFairway={state.toggleFairwayHit}
                onToggleGir={state.toggleGir}
                onActivatePowerup={handleActivatePowerup}
                onPrev={state.prevHole}
                onNext={state.nextHole}
                onFinishRound={handleFinishRound}
                finishError={finishError}
                hasPrev={state.currentHoleIndex > 0}
                hasNext={
                  state.currentHoleIndex < state.sortedHoles.length - 1
                }
                isLastHole={
                  state.currentHoleIndex === state.sortedHoles.length - 1
                }
              />
            )}
          </div>

          {/* Right panel: Round Summary */}
          <div className="w-screen h-full shrink-0">
            <RoundSummary
              holes={state.sortedHoles}
              scores={state.scores}
              courseName={courseName}
              playerName={playerName}
              onHoleSelect={(idx) => {
                state.navigateToHole(idx)
                setPanelIndex(0) // snap back to scoring panel
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Panel Dots + Chat Button (bottom) ─────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-black/20 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="w-8" /> {/* spacer */}
        <div className="flex items-center gap-2">
          {[-1, 0, 1].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPanelIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all touch-manipulation ${
                panelIndex === idx
                  ? 'bg-white scale-125'
                  : 'bg-white/30'
              }`}
              aria-label={
                idx === -1
                  ? 'Hole Overview'
                  : idx === 0
                    ? 'Scoring'
                    : 'Round Summary'
              }
            />
          ))}
        </div>
        <div className="w-8" /> {/* spacer */}
      </div>
    </div>
  )
}
