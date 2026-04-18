'use client'

import { StepperInput } from './StepperInput'
import { StatToggle } from './StatToggle'
import { hasFairway, canToggleGirOn } from './score-validation'
import { scoreName } from '@/lib/scoring-utils'
import type { HoleData, HoleScore, RejectionField, ActivePowerup } from './useLiveScoringState'
import type { PlayerPowerupData } from './PowerupTray'
import { PowerupTray } from './PowerupTray'
import { VariablePowerupBanner, type VariablePowerupState, type PowerupMessage } from './VariablePowerupBanner'
import { SlugIcon } from '@/components/draft/CardHand'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'

// ─── Score type styling ───────────────────────────────────────────────────────

type ScoreType = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double' | 'empty'

function getScoreType(strokes: number | null, par: number): ScoreType {
  if (strokes == null) return 'empty'
  const d = strokes - par
  if (d <= -2) return 'eagle'
  if (d === -1) return 'birdie'
  if (d === 0) return 'par'
  if (d === 1) return 'bogey'
  return 'double'
}

const SCORE_BADGE_STYLE: Record<ScoreType, string> = {
  eagle: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40',
  birdie: 'bg-red-400/20 text-red-300 border-red-400/40',
  par: 'bg-white/10 text-white/80 border-white/20',
  bogey: 'bg-white/5 text-white/60 border-white/10',
  double: 'bg-white/5 text-white/50 border-white/10',
  empty: 'hidden',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface HoleScoringProps {
  hole: HoleData
  score: HoleScore
  teeName?: string
  teeColor?: string
  powerupsEnabled: boolean
  playerPowerups: PlayerPowerupData[]
  activePowerups: ActivePowerup[]
  attacksReceived: ActivePowerup[]
  activeVariablePowerups: VariablePowerupState[]
  powerupMessage: PowerupMessage | null
  tournamentPlayers: { id: string; name: string }[]
  currentPlayerId: string
  rejection: { field: RejectionField; ts: number } | null
  saveStatus: 'idle' | 'saving' | 'saved'
  runningScore: { holesPlayed: number; diff: number | null }

  onIncrementStrokes: () => void
  onDecrementStrokes: () => void
  onIncrementPutts: () => void
  onDecrementPutts: () => void
  onToggleFairway: () => void
  onToggleGir: () => void
  onTogglePowerup: () => void
  onActivatePowerup: (data: { playerPowerupId: string; targetPlayerId?: string; metadata?: Record<string, unknown> }) => Promise<void>
  onPrev: () => void
  onNext: () => void
  onFinishRound: () => void
  finishError: string | null
  hasPrev: boolean
  hasNext: boolean
  isLastHole: boolean
}

export function HoleScoring({
  hole,
  score,
  teeName,
  teeColor,
  powerupsEnabled,
  playerPowerups,
  activePowerups,
  attacksReceived,
  activeVariablePowerups,
  powerupMessage,
  tournamentPlayers,
  currentPlayerId,
  rejection,
  saveStatus,
  runningScore,
  onIncrementStrokes,
  onDecrementStrokes,
  onIncrementPutts,
  onDecrementPutts,
  onToggleFairway,
  onToggleGir,
  onTogglePowerup,
  onActivatePowerup,
  onPrev,
  onNext,
  onFinishRound,
  finishError,
  hasPrev,
  hasNext,
  isLastHole,
}: HoleScoringProps) {
  const scoreType = getScoreType(score.strokes, hole.par)
  const scoreLabel = score.strokes !== null
    ? score.strokes === 1
      ? 'Hole in One'
      : scoreName(score.strokes - hole.par)
    : null
  const girDisabled =
    score.strokes === null ||
    score.putts === null ||
    !canToggleGirOn(score.strokes, score.putts, hole.par)
  // GIR can always be toggled OFF, only restrict toggling ON
  const girToggleDisabled = score.gir !== true && girDisabled

  const runningDiffText =
    runningScore.holesPlayed > 0
      ? runningScore.diff === 0
        ? 'E'
        : runningScore.diff !== null && runningScore.diff > 0
          ? `+${runningScore.diff}`
          : `${runningScore.diff}`
      : null

  return (
    <div className="flex flex-col h-full">
      {/* ── Hole Info Header ──────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-heading font-bold text-white">
                Hole {hole.number}
              </h2>
              {scoreLabel && (
                <span
                  className={`text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${SCORE_BADGE_STYLE[scoreType]}`}
                >
                  {scoreLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-white/90 mt-0.5 flex items-center gap-1 flex-wrap">
              <span>Par {hole.par}</span>
              {hole.yards && (
                <span>
                  &middot; {hole.yards} yds
                  {teeName && (
                    <>
                      {' '}
                      <span className="inline-flex items-center gap-1 ml-0.5">
                        {teeColor && (
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full border border-white/30"
                            style={{ backgroundColor: teeColor }}
                          />
                        )}
                        <span className="font-semibold text-white">{teeName}</span>
                      </span>
                    </>
                  )}
                </span>
              )}
            </p>
          </div>

          {/* Running score badge */}
          <div className="text-right">
            <p className="text-xs text-white/80 uppercase tracking-wider">
              Your Score
            </p>
            {runningDiffText && (
              <p className="text-lg font-heading font-bold text-white">
                {runningDiffText}
                <span className="text-xs font-normal text-white/70 block">
                  After {runningScore.holesPlayed} hole
                  {runningScore.holesPlayed !== 1 ? 's' : ''}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bezel divider ── */}
      <div className="mx-5 h-px bg-white/15" />

      {/* ── Active Powerups (between hole info and strokes) ── */}
      {powerupsEnabled && (activePowerups.length > 0 || attacksReceived.length > 0) && (
        <div className="px-5 pt-3 space-y-1.5">
          {activePowerups.map((ap) => {
            const isAtk = ap.powerupType === 'ATTACK'
            return (
              <div
                key={ap.playerPowerupId}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.25)] ${
                  isAtk ? 'bg-red-50' : 'bg-emerald-50'
                }`}
              >
                <SlugIcon slug={ap.powerupSlug} isAttack={isAtk} className={`w-5 h-5 shrink-0 ${isAtk ? 'text-red-700' : 'text-emerald-800'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isAtk ? 'text-red-800' : 'text-emerald-900'}`}>{ap.powerupName}</p>
                  {ap.scoreModifier !== null && (
                    <p className={`text-[10px] ${isAtk ? 'text-red-600/70' : 'text-emerald-700/70'}`}>
                      {ap.scoreModifier > 0 ? '+' : ''}{ap.scoreModifier} strokes
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          {attacksReceived.map((ar) => (
            <div
              key={ar.playerPowerupId}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 bg-red-50 border-red-700"
            >
              <SlugIcon slug={ar.powerupSlug} isAttack className="w-5 h-5 shrink-0 text-red-700" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800 truncate">{ar.powerupName}</p>
                <p className="text-[10px] text-red-600/70">{ar.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Variable Powerup Banner (Fairway Finder / King of the Hill) ── */}
      {powerupsEnabled && (activeVariablePowerups.length > 0 || powerupMessage) && (
        <VariablePowerupBanner
          activeVariablePowerups={activeVariablePowerups}
          powerupMessage={powerupMessage}
        />
      )}

      {/* ── Scoring Controls ──────────────────────────────────────────── */}
      <div className="flex-1 px-5 py-4 space-y-6 overflow-y-auto">
        {/* Strokes */}
        <StepperInput
          label="Strokes"
          value={score.strokes}
          onIncrement={onIncrementStrokes}
          onDecrement={onDecrementStrokes}
          rejectionTs={rejection?.field === 'strokes' ? rejection.ts : null}
          size="lg"
        />

        {/* Putts */}
        <StepperInput
          label="Putts"
          value={score.putts}
          onIncrement={onIncrementPutts}
          onDecrement={onDecrementPutts}
          rejectionTs={rejection?.field === 'putts' ? rejection.ts : null}
          size="md"
        />

        {/* Toggles */}
        <div className="border-t border-white/20 pt-2 space-y-1">
          {hasFairway(hole.par) && (
            <StatToggle
              label="Fairway Hit"
              checked={score.fairwayHit}
              onCheckedChange={onToggleFairway}
              rejectionTs={
                rejection?.field === 'fairway' ? rejection.ts : null
              }
            />
          )}

          <StatToggle
            label="Green in Regulation"
            checked={score.gir}
            onCheckedChange={onToggleGir}
            disabled={girToggleDisabled}
            rejectionTs={rejection?.field === 'gir' ? rejection.ts : null}
          />

          {powerupsEnabled && (
            <PowerupTray
              playerPowerups={playerPowerups}
              activePowerups={activePowerups}
              attacksReceived={attacksReceived}
              onActivate={onActivatePowerup}
              tournamentPlayers={tournamentPlayers}
              currentPlayerId={currentPlayerId}
            />
          )}
        </div>
      </div>

      {/* ── Bottom Navigation + Status ────────────────────────────────── */}
      <div className="px-5 pt-2 space-y-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {/* Error / Save status */}
        <div className="min-h-5 flex items-center justify-center">
          {finishError ? (
            <p className="text-xs text-red-400 font-medium text-center px-2">
              {finishError}
            </p>
          ) : saveStatus === 'saving' ? (
            <span className="text-xs text-white/80">Saving...</span>
          ) : saveStatus === 'saved' ? (
            <span className="flex items-center gap-1 text-xs text-green-400/80">
              <Check className="w-3 h-3" />
              Saved
            </span>
          ) : null}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className="flex items-center gap-1 px-4 py-3 rounded-lg bg-white/20 text-white font-semibold text-sm disabled:opacity-30 active:scale-95 transition-all touch-manipulation"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>

          <button
            type="button"
            onClick={isLastHole ? onFinishRound : onNext}
            disabled={!hasNext && !isLastHole}
            className="flex-1 flex items-center justify-center gap-1 px-4 py-3 rounded-lg font-semibold text-sm active:scale-95 transition-all touch-manipulation"
            style={{
              backgroundColor: 'var(--color-accent, oklch(0.72 0.11 78))',
              color: 'var(--color-primary, oklch(0.40 0.11 160))',
            }}
          >
            {isLastHole ? 'Finish Round' : 'Next Hole'}
            {!isLastHole && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
