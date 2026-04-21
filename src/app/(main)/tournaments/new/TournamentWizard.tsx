'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StepTournamentType, type TournamentTypeState } from '@/components/wizard/StepTournamentType'
import { StepBasicInfo, type BasicInfoState } from '@/components/wizard/StepBasicInfo'
import { StepRounds, buildDefaultRounds, type RoundState } from '@/components/wizard/StepRounds'
import { StepHandicap } from '@/components/wizard/StepHandicap'
import { StepPowerups, type PowerupsState } from '@/components/wizard/StepPowerups'
import { UpgradeBanner } from '@/components/UpgradeBanner'
import { TIER_LIMITS } from '@/lib/tiers'
import { createTournamentFromWizard } from './actions'

export interface RenewalDefaults {
  parentTournamentId: string
  isLeague: boolean
  name: string
  description: string
  primaryColor: string
  accentColor: string
  handicapSystem: 'NONE' | 'WHS' | 'STABLEFORD' | 'CALLAWAY' | 'PEORIA'
  powerupsEnabled: boolean
  powerupsPerPlayer: number
  maxAttacksPerPlayer: number
  distributionMode: 'DRAFT' | 'RANDOM'
  isOpenRegistration: boolean
  rounds: Array<{ courseId: string; courseName: string; coursePar: number; teeMode: 'UNIFORM' | 'CUSTOM' }>
}

interface Props {
  renewalDefaults?: RenewalDefaults | null
  userTier?: 'FREE' | 'PRO' | 'CLUB' | 'LEAGUE'
  proCredits?: number
  requiresUpgrade?: boolean
}

function inferTypeFromDefaults(d: RenewalDefaults): 'PUBLIC' | 'OPEN' | 'INVITE' {
  if (!d.isOpenRegistration) return 'INVITE'
  if (!d.powerupsEnabled) return 'PUBLIC'
  return 'OPEN'
}

export function TournamentWizard({ renewalDefaults, hasLeague, userTier = 'FREE', proCredits = 0, requiresUpgrade = false }: Props & { hasLeague?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')

  const [tournamentType, setTournamentType] = useState<TournamentTypeState>({
    tournamentType: renewalDefaults ? inferTypeFromDefaults(renewalDefaults) : 'OPEN',
    inviteEmails: [],
    inviteList: [],
  })

  const [basicInfo, setBasicInfo] = useState<BasicInfoState>({
    name: renewalDefaults?.name ?? '',
    description: renewalDefaults?.description ?? '',
    isLeague: renewalDefaults?.isLeague ?? false,
    leagueEndDate: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    numRounds: renewalDefaults?.rounds.length ?? 1,
    logoPreview: null,
    logoBase64: null,
    logoMime: null,
    logoExt: null,
    headerPreview: null,
    headerBase64: null,
    headerMime: null,
    headerExt: null,
    primaryColor: renewalDefaults?.primaryColor ?? '#006747',
    accentColor: renewalDefaults?.accentColor ?? '#C9A84C',
  })

  const defaultRounds = buildDefaultRounds(renewalDefaults?.rounds.length ?? 1)
  if (renewalDefaults) {
    renewalDefaults.rounds.forEach((r, i) => {
      if (i < defaultRounds.length) {
        defaultRounds[i] = {
          ...defaultRounds[i],
          courseId: r.courseId,
          course: { id: r.courseId, name: r.courseName, par: r.coursePar, teeOptions: [] },
          teeMode: r.teeMode,
        }
      }
    })
  }
  const [rounds, setRounds] = useState<RoundState[]>(defaultRounds)

  const [handicapSystem, setHandicapSystem] = useState<'NONE' | 'WHS' | 'STABLEFORD' | 'CALLAWAY' | 'PEORIA'>(
    renewalDefaults?.handicapSystem ?? 'WHS'
  )

  const [powerups, setPowerups] = useState<PowerupsState>({
    powerupsEnabled: renewalDefaults?.powerupsEnabled ?? false,
    powerupsPerPlayer: renewalDefaults?.powerupsPerPlayer ?? 3,
    maxAttacksPerPlayer: renewalDefaults?.maxAttacksPerPlayer ?? 1,
    distributionMode: renewalDefaults?.distributionMode ?? 'DRAFT',
    draftFormat: 'SNAKE',
    draftTiming: 'PRE_TOURNAMENT',
  })

  // Derive which steps to show based on tournament type
  const isPublic = tournamentType.tournamentType === 'PUBLIC'
  const isFree = userTier === 'FREE'

  const steps = useMemo(() => {
    const s = [
      { label: 'Type', short: '1' },
      { label: 'Basics', short: '2' },
      { label: 'Rounds', short: '3' },
      { label: 'Handicap', short: '4' },
    ]
    // Public tournaments and free-tier users skip Powerups step
    if (!isPublic && !isFree) {
      s.push({ label: 'Powerups', short: String(s.length + 1) })
    }
    return s
  }, [isPublic, isFree])

  // Keep rounds array in sync with numRounds
  function handleBasicInfoChange(v: BasicInfoState) {
    setBasicInfo(v)
    if (v.numRounds !== rounds.length) {
      const next = buildDefaultRounds(v.numRounds)
      rounds.forEach((r, i) => {
        if (i < next.length) next[i] = { ...next[i], ...r, roundNumber: i + 1 }
      })
      setRounds(next)
    }
  }

  function validateStep(): string {
    if (step === 1 && !basicInfo.name.trim()) return 'Tournament name is required.'
    if (step === 2) {
      for (const r of rounds.slice(0, basicInfo.numRounds)) {
        if (!r.courseId) return `Please select a course for Round ${r.roundNumber}.`
      }
    }
    return ''
  }

  function validateAll(): string {
    if (!basicInfo.name.trim()) return 'Tournament name is required.'
    for (const r of rounds.slice(0, basicInfo.numRounds)) {
      if (!r.courseId) return `Please select a course for Round ${r.roundNumber}.`
      // Only enforce date constraints for non-public tournaments
      if (!isPublic) {
        if (r.date && basicInfo.startDate && r.date < basicInfo.startDate)
          return `Round ${r.roundNumber} date cannot be before the tournament start date.`
        if (r.date && basicInfo.endDate && r.date > basicInfo.endDate)
          return `Round ${r.roundNumber} date cannot be after the tournament end date.`
      }
    }
    return ''
  }

  function handleNext() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError('')
    setStep((s) => s + 1)
  }

  function handleSubmit() {
    const err = validateAll()
    if (err) { setError(err); return }
    setError('')

    // Derive registration settings from tournament type
    const isOpenRegistration = tournamentType.tournamentType !== 'INVITE'
    const inviteEmails = tournamentType.tournamentType === 'INVITE' ? tournamentType.inviteEmails : []
    const inviteList = tournamentType.tournamentType === 'INVITE' ? (tournamentType.inviteList ?? []) : []
    const effectivePowerups = isPublic
      ? { ...powerups, powerupsEnabled: false }
      : powerups

    startTransition(async () => {
      try {
        const activeRounds = rounds.slice(0, basicInfo.numRounds)
        const result = await createTournamentFromWizard({
          name: basicInfo.name,
          description: basicInfo.description,
          startDate: basicInfo.startDate,
          endDate: basicInfo.endDate,
          numRounds: basicInfo.numRounds,
          logoBase64: basicInfo.logoBase64,
          logoMime: basicInfo.logoMime,
          logoExt: basicInfo.logoExt,
          headerBase64: basicInfo.headerBase64,
          headerMime: basicInfo.headerMime,
          headerExt: basicInfo.headerExt,
          primaryColor: basicInfo.primaryColor,
          accentColor: basicInfo.accentColor,
          rounds: activeRounds.map((r) => ({
            roundNumber: r.roundNumber,
            date: r.date,
            courseId: r.courseId,
            teeMode: r.teeMode,
            holeTees: r.teeMode === 'CUSTOM' ? r.holeTees : [],
          })),
          handicapSystem,
          ...effectivePowerups,
          isOpenRegistration,
          inviteEmails,
          inviteList,
          tournamentType: tournamentType.tournamentType,
          parentTournamentId: renewalDefaults?.parentTournamentId ?? null,
          isLeague: basicInfo.isLeague,
          leagueEndDate: basicInfo.leagueEndDate || undefined,
          registrationDeadline: basicInfo.registrationDeadline || undefined,
        })
        if ('error' in result) {
          setError(result.error)
          return
        }
        router.push(`/${result.slug}`)
      } catch (e) {
        console.error('[create tournament]', e)
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      }
    })
  }

  const isLast = step === steps.length - 1

  // Determine which Pro-only features are being used
  const proFeatures = useMemo(() => {
    const reasons: string[] = []
    if (basicInfo.numRounds > TIER_LIMITS.FREE.maxRounds) {
      reasons.push(`Multi-round tournaments (you selected ${basicInfo.numRounds} rounds)`)
    }
    if (!isPublic && powerups.powerupsEnabled && !TIER_LIMITS.FREE.powerups) {
      reasons.push('Powerups')
    }
    return reasons
  }, [basicInfo.numRounds, isPublic, powerups.powerupsEnabled])

  // Map step index to content
  // Step 0: Type, Step 1: Basics, Step 2: Rounds, Step 3: Handicap, Step 4: Powerups (non-public only)
  function renderStep() {
    switch (step) {
      case 0:
        return <StepTournamentType value={tournamentType} onChange={setTournamentType} />
      case 1:
        return <StepBasicInfo value={basicInfo} onChange={handleBasicInfoChange} isFree={isFree} tournamentType={tournamentType.tournamentType} />
      case 2:
        return <StepRounds numRounds={basicInfo.numRounds} value={rounds} onChange={setRounds} startDate={basicInfo.startDate || undefined} endDate={basicInfo.endDate || undefined} isOpenRegistration={isPublic} />
      case 3:
        return <StepHandicap value={handicapSystem} onChange={setHandicapSystem} />
      case 4:
        // Only reached for non-public tournaments
        return <StepPowerups value={powerups} onChange={setPowerups} />
      default:
        return null
    }
  }

  // Renewal requires upgrade — show blocking interstitial
  if (requiresUpgrade) {
    return (
      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-heading font-bold">Upgrade Required</h1>
          <p className="text-muted-foreground">
            This tournament used custom branding. To renew with branding, purchase a Pro tournament credit ($29) or upgrade to the Tour plan ($199/season).
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition">
              View Plans
            </Link>
            <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">
          {renewalDefaults ? 'Renew Tournament' : 'Create Tournament'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Step {step + 1} of {steps.length}</p>
        {renewalDefaults && (
          <p className="text-xs text-muted-foreground mt-1">
            Pre-filled from previous tournament. Update dates and details as needed.
          </p>
        )}
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1 mb-8">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                i < step
                  ? 'bg-[var(--color-primary)] text-white'
                  : i === step
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] ring-2 ring-[var(--color-primary)]'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < step ? '✓' : s.short}
            </div>
            <span className={`hidden sm:block ml-1.5 text-xs ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
            {i < steps.length - 1 && (
              <div className={`h-px flex-1 mx-2 ${i < step ? 'bg-[var(--color-primary)]' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div>{renderStep()}</div>

      {/* Pro upgrade banner — shown when config exceeds Free tier */}
      {proFeatures.length > 0 && !hasLeague && (
        <UpgradeBanner reasons={proFeatures} />
      )}



      {error && <p className="text-sm text-destructive mt-3">{error}</p>}

      {/* Navigation */}
      <div className="flex justify-between mt-6 pt-4 border-t border-border">
        {step === 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Exit
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => { setError(''); setStep((s) => s - 1) }}
          >
            Back
          </Button>
        )}

        {isLast ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            style={{ backgroundColor: 'var(--color-primary)' }}
            className="text-white min-w-32"
          >
            {isPending ? 'Creating...' : renewalDefaults ? 'Renew Tournament' : 'Create Tournament'}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            style={{ backgroundColor: 'var(--color-primary)' }}
            className="text-white"
          >
            Next: {steps[step + 1].label} →
          </Button>
        )}
      </div>
    </main>
  )
}
