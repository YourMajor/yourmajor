'use client'

import { useState } from 'react'
import { Info, X } from 'lucide-react'
import { allocateHandicapStrokes, callawayDeduction, getCallawayAdjustment, CALLAWAY_TABLE } from '@/lib/scoring-utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { NineTable } from './detail/NineTable'
import { RoundChart } from './detail/RoundChart'
import { RoundInsights } from './detail/RoundInsights'
import { ScorecardStats } from './detail/ScorecardStats'

interface HoleScore {
  holeNumber: number
  par: number
  strokes: number
  handicapIndex: number | null
  putts?: number | null
  fairwayHit?: boolean | null
  gir?: boolean | null
}

interface CourseHole {
  number: number
  par: number
  handicap: number | null
}

interface Props {
  scores: HoleScore[]
  handicap: number
  playerName: string
  avatarUrl?: string | null
  handicapSystem?: string
  courseName?: string
  coursePar?: number
  courseHoles?: CourseHole[]
  powerupModifier?: number
}

export function ScorecardDetail({ scores, handicap, playerName, avatarUrl, handicapSystem = 'WHS', courseName, coursePar: courseParProp, courseHoles, powerupModifier = 0 }: Props) {
  const [showNetBreakdown, setShowNetBreakdown] = useState(false)

  // Build full hole list: merge course holes (if provided) with scores
  const scoreMap = new Map(scores.map((s) => [s.holeNumber, s]))
  const allHoles: Array<HoleScore & { hasScore: boolean }> = courseHoles
    ? courseHoles.map((ch) => {
        const score = scoreMap.get(ch.number)
        return score
          ? { ...score, hasScore: true }
          : { holeNumber: ch.number, par: ch.par, strokes: 0, handicapIndex: ch.handicap, hasScore: false }
      })
    : scores.map((s) => ({ ...s, hasScore: true }))

  const sorted = [...allHoles].sort((a, b) => a.holeNumber - b.holeNumber)
  const front  = sorted.filter((s) => s.holeNumber <= 9)
  const back   = sorted.filter((s) => s.holeNumber > 9)
  const scoredHoles = sorted.filter((s) => s.hasScore)

  const strokeHoles = allocateHandicapStrokes(
    Math.round(handicap),
    sorted.map((s) => ({ number: s.holeNumber, handicap: s.handicapIndex }))
  )

  const frontScored = front.filter((h) => h.hasScore)
  const backScored  = back.filter((h) => h.hasScore)
  const frontPar    = front.reduce((s, h) => s + h.par, 0)
  const backPar     = back.reduce((s, h) => s + h.par, 0)
  const totalPar    = frontPar + backPar
  const playedPar   = scoredHoles.reduce((s, h) => s + h.par, 0)
  const frontGross  = frontScored.reduce((s, h) => s + h.strokes, 0)
  const backGross   = backScored.reduce((s, h) => s + h.strokes, 0)
  const totalGross  = frontGross + backGross
  const adjustedGross = totalGross + powerupModifier

  const isCallaway = handicapSystem === 'CALLAWAY'
  const effectiveCoursePar = courseParProp ?? totalPar

  const callawayCanonicalDeduction = isCallaway
    ? callawayDeduction(adjustedGross, scoredHoles.map((s) => ({ strokes: s.strokes, par: s.par, holeNumber: s.holeNumber })))
    : 0

  const callawayBreakdown = isCallaway ? (() => {
    type DeductedHole = { holeNumber: number; strokes: number; capped: number; deductedAmount: number }
    if (adjustedGross <= 71) return { deduction: 0, adjustment: 0, deductedHoles: [] as DeductedHole[], halfHoleIndex: -1, halfHolesLabel: 'Scratch' }

    const eligible = scoredHoles
      .filter((s) => s.holeNumber <= 16)
      .map((s) => ({ holeNumber: s.holeNumber, strokes: s.strokes, capped: Math.min(s.strokes, s.par * 2), par: s.par }))
      .sort((a, b) => b.capped - a.capped)

    const tableRow = CALLAWAY_TABLE.find(([min, max]) => adjustedGross >= min && adjustedGross <= max)
    const halfHolesCount = tableRow ? tableRow[2] : 12
    const fullHoles = Math.floor(halfHolesCount / 2)
    const hasHalf = halfHolesCount % 2 === 1

    const halfHolesLabel = hasHalf
      ? `${fullHoles} 1/2 Worst Hole${fullHoles > 0 ? 's' : ''}`
      : `${fullHoles} Worst Hole${fullHoles !== 1 ? 's' : ''}`

    const deductedHoles: DeductedHole[] = []
    for (let i = 0; i < fullHoles && i < eligible.length; i++) {
      deductedHoles.push({ ...eligible[i], deductedAmount: eligible[i].capped })
    }
    const halfHoleIndex = hasHalf && eligible[fullHoles] ? deductedHoles.length : -1
    if (hasHalf && eligible[fullHoles]) {
      const halfVal = Math.floor(eligible[fullHoles].capped / 2)
      deductedHoles.push({ ...eligible[fullHoles], deductedAmount: halfVal })
    }

    const adjustment = getCallawayAdjustment(adjustedGross)
    return { deduction: callawayCanonicalDeduction, adjustment, deductedHoles, halfHoleIndex, halfHolesLabel }
  })() : null

  const totalNet = isCallaway
    ? adjustedGross - callawayCanonicalDeduction
    : adjustedGross - Math.round(handicap)
  const diffGross   = totalGross - playedPar
  const diffNet     = totalNet - playedPar
  const isComplete  = scoredHoles.length > 0
  const allHolesPlayed = scoredHoles.length === sorted.length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Avatar className="size-10 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={playerName} />}
            <AvatarFallback className="text-sm font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
              {playerName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-semibold text-sm">{playerName}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">HCP {handicap}</span>
          <span className="font-semibold">Gross {totalGross}</span>
          <span className="text-muted-foreground">
            ({diffGross >= 0 ? '+' : ''}{diffGross} / Net {diffNet >= 0 ? '+' : ''}{diffNet})
          </span>
        </div>
      </div>

      <NineTable holes={front} label="Out" totalPar={frontPar} totalGross={frontGross} strokeHoles={strokeHoles} />
      <NineTable holes={back} label="In" totalPar={backPar} totalGross={backGross} strokeHoles={strokeHoles} />

      {/* Totals bar */}
      <div className="flex items-center justify-between rounded-xl border border-border p-3" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
        <div className="text-center flex-1">
          <p className="text-[11px] uppercase tracking-wider text-white/70">Gross</p>
          <p className="text-2xl font-heading font-bold">{totalGross}</p>
        </div>
        <div className="w-px h-10 bg-white/20" />
        <div className="text-center flex-1">
          <p className="text-[11px] uppercase tracking-wider text-white/70">Net</p>
          <div className="flex items-center justify-center gap-1">
            <p className="text-2xl font-heading font-bold">{totalNet}</p>
            {isComplete && (
              <button
                type="button"
                onClick={() => setShowNetBreakdown(true)}
                className="w-5 h-5 rounded-full bg-white/25 hover:bg-white/40 flex items-center justify-center transition-colors shrink-0 ml-0.5"
                aria-label="Net score breakdown"
              >
                <Info className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        </div>
        <div className="w-px h-10 bg-white/20" />
        <div className="text-center flex-1">
          <p className="text-[11px] uppercase tracking-wider text-white/70">vs Par</p>
          <p className="text-2xl font-heading font-bold">
            {diffGross >= 0 ? '+' : ''}{diffGross}
          </p>
        </div>
      </div>

      {/* Net Score Breakdown Popup */}
      {showNetBreakdown && (
        <NetBreakdownModal
          onClose={() => setShowNetBreakdown(false)}
          handicapSystem={handicapSystem}
          courseName={courseName}
          effectiveCoursePar={effectiveCoursePar}
          allHolesPlayed={allHolesPlayed}
          scoredHolesCount={scoredHoles.length}
          playedPar={playedPar}
          totalGross={totalGross}
          powerupModifier={powerupModifier}
          adjustedGross={adjustedGross}
          handicap={handicap}
          isCallaway={isCallaway}
          callawayBreakdown={callawayBreakdown}
          totalNet={totalNet}
          diffNet={diffNet}
          strokeHoles={strokeHoles}
          sorted={sorted}
        />
      )}

      {/* Handicap stroke legend */}
      {strokeHoles.size > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--color-primary)' }} />
          Handicap stroke received on that hole
        </p>
      )}

      {scoredHoles.length >= 9 && <RoundChart holes={scoredHoles} />}
      {scoredHoles.length >= 9 && <RoundInsights holes={scoredHoles} />}
      <ScorecardStats scores={scores} />
    </div>
  )
}

// ─── Net Breakdown Modal ──────────────────────────────────────────────────

interface NetBreakdownProps {
  onClose: () => void
  handicapSystem: string
  courseName?: string
  effectiveCoursePar: number
  allHolesPlayed: boolean
  scoredHolesCount: number
  playedPar: number
  totalGross: number
  powerupModifier: number
  adjustedGross: number
  handicap: number
  isCallaway: boolean
  callawayBreakdown: {
    deduction: number
    adjustment: number
    deductedHoles: Array<{ holeNumber: number; strokes: number; capped: number; deductedAmount: number }>
    halfHoleIndex: number
    halfHolesLabel: string
  } | null
  totalNet: number
  diffNet: number
  strokeHoles: Set<number>
  sorted: Array<{ holeNumber: number; handicapIndex: number | null }>
}

function NetBreakdownModal({
  onClose, handicapSystem, courseName, effectiveCoursePar, allHolesPlayed,
  scoredHolesCount, playedPar, totalGross, powerupModifier, adjustedGross,
  handicap, isCallaway, callawayBreakdown, totalNet, diffNet, strokeHoles, sorted,
}: NetBreakdownProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-background rounded-xl border border-border shadow-xl max-w-sm w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--color-primary)' }}>
          <h3 className="font-heading font-bold text-white text-lg">Net Score Breakdown</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-border text-muted-foreground">
              {handicapSystem === 'NONE' ? 'No Handicap (Gross)' :
               handicapSystem === 'WHS' ? 'World Handicap System' :
               handicapSystem === 'STABLEFORD' ? 'Stableford' :
               handicapSystem === 'CALLAWAY' ? 'Callaway System' :
               handicapSystem === 'PEORIA' ? 'Peoria System' : handicapSystem}
            </span>
          </div>

          <div className="space-y-2">
            {courseName && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Course</span>
                <span className="font-medium">{courseName}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Course Par (full)</span>
              <span className="font-bold">{effectiveCoursePar}</span>
            </div>
            {!allHolesPlayed && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Par ({scoredHolesCount} holes played)</span>
                <span className="font-bold">{playedPar}</span>
              </div>
            )}
            <div className="h-px bg-border" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gross Score ({scoredHolesCount} holes)</span>
              <span className="font-bold">{totalGross}</span>
            </div>
            {powerupModifier !== 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Powerup Modifier</span>
                  <span className="font-bold text-purple-600">{powerupModifier > 0 ? '+' : ''}{powerupModifier}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Adjusted Gross</span>
                  <span className="font-bold">{adjustedGross}</span>
                </div>
              </>
            )}

            {isCallaway && callawayBreakdown ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Deduction ({callawayBreakdown.halfHolesLabel})</span>
                <span className="font-bold text-primary">-{callawayBreakdown.deduction}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Handicap Index</span>
                  <span className="font-bold">{handicap}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Strokes Received</span>
                  <span className="font-bold text-primary">-{Math.round(handicap)}</span>
                </div>
              </>
            )}

            <div className="h-px bg-border" />
            <div className="flex justify-between text-sm font-bold text-lg">
              <span>Net Score</span>
              <span>{totalNet}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>Net vs Par</span>
              <span className={diffNet < 0 ? 'text-red-600' : ''}>
                {diffNet >= 0 ? '+' : ''}{diffNet}
              </span>
            </div>
          </div>

          {/* Callaway: deducted holes detail */}
          {isCallaway && callawayBreakdown && callawayBreakdown.deductedHoles.length > 0 && (
            <CallawayDeductionDetail breakdown={callawayBreakdown} sorted={sorted} />
          )}

          {/* WHS: Stroke allocation detail */}
          {!isCallaway && strokeHoles.size > 0 && (
            <StrokeAllocationDetail handicap={handicap} strokeHoles={strokeHoles} sorted={sorted} />
          )}
        </div>
      </div>
    </div>
  )
}

function CallawayDeductionDetail({ breakdown, sorted }: {
  breakdown: NonNullable<NetBreakdownProps['callawayBreakdown']>
  sorted: Array<{ holeNumber: number }>
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Worst Holes Deducted</p>
      <p className="text-xs text-muted-foreground">
        Holes 17 &amp; 18 are excluded. Scores capped at 2&times;par before ranking. Worst holes deducted first.
      </p>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="py-1.5 px-3 text-left text-[11px] font-bold text-muted-foreground uppercase">Hole</th>
              <th className="py-1.5 px-3 text-center text-[11px] font-bold text-muted-foreground uppercase">Score</th>
              <th className="py-1.5 px-3 text-center text-[11px] font-bold text-muted-foreground uppercase">Capped</th>
              <th className="py-1.5 px-3 text-right text-[11px] font-bold text-muted-foreground uppercase">Deducted</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.deductedHoles.map((dh, idx) => {
              const isHalf = idx === breakdown.halfHoleIndex
              return (
                <tr key={dh.holeNumber} className="border-t border-border">
                  <td className="py-1.5 px-3 font-semibold">
                    Hole {dh.holeNumber}
                    {isHalf && <span className="text-[11px] text-muted-foreground ml-1">(half)</span>}
                  </td>
                  <td className="py-1.5 px-3 text-center text-muted-foreground">{dh.strokes}</td>
                  <td className="py-1.5 px-3 text-center text-muted-foreground">
                    {dh.capped < dh.strokes ? dh.capped : ''}
                  </td>
                  <td className="py-1.5 px-3 text-right font-bold text-primary">-{dh.deductedAmount}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30">
              <td colSpan={3} className="py-1.5 px-3 font-bold text-xs">Subtotal</td>
              <td className="py-1.5 px-3 text-right font-bold text-primary">
                -{breakdown.deductedHoles.reduce((s, h) => s + h.deductedAmount, 0)}
              </td>
            </tr>
            <tr className="border-t border-border bg-muted/30">
              <td colSpan={3} className="py-1.5 px-3 font-bold text-xs">Callaway Adjustment</td>
              <td className="py-1.5 px-3 text-right font-bold text-muted-foreground">
                {breakdown.adjustment > 0 ? '+' : ''}{breakdown.adjustment}
              </td>
            </tr>
            <tr className="border-t border-border bg-muted/30">
              <td colSpan={3} className="py-1.5 px-3 font-bold">Total Deduction</td>
              <td className="py-1.5 px-3 text-right font-bold text-primary">-{breakdown.deduction}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sorted.filter((h) => h.holeNumber <= 16).map((h) => {
          const isDeducted = breakdown.deductedHoles.some((dh) => dh.holeNumber === h.holeNumber)
          return (
            <div
              key={h.holeNumber}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                isDeducted ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
              }`}
            >
              {h.holeNumber}
            </div>
          )
        })}
        {sorted.filter((h) => h.holeNumber > 16).map((h) => (
          <div
            key={h.holeNumber}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-border text-muted-foreground/40 line-through"
            title="Excluded from Callaway"
          >
            {h.holeNumber}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Highlighted = deducted. Holes 17-18 are excluded from the Callaway system.
      </p>
    </div>
  )
}

function StrokeAllocationDetail({ handicap, strokeHoles, sorted }: {
  handicap: number
  strokeHoles: Set<number>
  sorted: Array<{ holeNumber: number; handicapIndex: number | null }>
}) {
  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stroke Allocation by Hole</p>
      <p className="text-xs text-muted-foreground">
        {Math.round(handicap)} strokes distributed to holes with the highest handicap index (hardest holes first).
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((h) => {
          const receives = strokeHoles.has(h.holeNumber)
          return (
            <div
              key={h.holeNumber}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                receives ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
              }`}
              title={`Hole ${h.holeNumber}${h.handicapIndex ? ` (HCP ${h.handicapIndex})` : ''}${receives ? ' — receives stroke' : ''}`}
            >
              {h.holeNumber}
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">Highlighted holes receive a handicap stroke.</p>
    </div>
  )
}
