'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StepTournamentType, type TournamentTypeState } from '@/components/wizard/StepTournamentType'
import { StepBasicInfo, type BasicInfoState } from '@/components/wizard/StepBasicInfo'
import { StepRounds, buildDefaultRounds, type RoundState } from '@/components/wizard/StepRounds'
import { StepFormat } from '@/components/wizard/StepFormat'
import { StepPowerups, type PowerupsState } from '@/components/wizard/StepPowerups'
import type { FormatId } from '@/lib/formats/types'
import { defaultFormatConfig, getFormat } from '@/lib/formats/registry'
import { UpgradeBanner } from '@/components/UpgradeBanner'
import { TIER_LIMITS } from '@/lib/tiers'
import { createTournamentFromWizard } from './actions'

type StepId = 'type' | 'basics' | 'rounds' | 'format' | 'powerups'

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

export function TournamentWizard({ renewalDefaults, hasLeague, userTier = 'FREE', requiresUpgrade = false }: Props & { hasLeague?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [imageUploading, setImageUploading] = useState(false)

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
    logoUrl: null,
    headerPreview: null,
    headerImageUrl: null,
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

  // When renewing, map the prior tournament's handicapSystem to the equivalent Format card
  // so the user lands on the same scoring scheme they used last time.
  function renewalFormatFor(d: RenewalDefaults | null | undefined): FormatId {
    if (!d) return userTier === 'FREE' ? 'STROKE_PLAY' : 'STROKE_PLAY_NET'
    switch (d.handicapSystem) {
      case 'CALLAWAY':   return 'CALLAWAY'
      case 'PEORIA':     return 'PEORIA'
      case 'STABLEFORD': return 'STABLEFORD'
      case 'WHS':        return 'STROKE_PLAY_NET'
      case 'NONE':       return 'STROKE_PLAY'
      default:           return 'STROKE_PLAY_NET'
    }
  }

  const [tournamentFormat, setTournamentFormat] = useState<FormatId>(renewalFormatFor(renewalDefaults))

  // Handicap system is derived from the chosen format's impliedHandicap (every format
  // declares one). Single source of truth — no separate Handicap step in the wizard.
  const handicapSystem = getFormat(tournamentFormat).impliedHandicap ?? 'NONE'

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
    const s: Array<{ id: StepId; label: string; short: string }> = [
      { id: 'type',   label: 'Type',   short: '1' },
      { id: 'basics', label: 'Basics', short: '2' },
    ]
    // Leagues build their schedule post-setup, so the per-round step is skipped.
    if (!basicInfo.isLeague) s.push({ id: 'rounds', label: 'Rounds', short: String(s.length + 1) })
    // Format owns the handicap decision via FormatDef.impliedHandicap — no
    // separate Handicap step.
    s.push({ id: 'format',   label: 'Format',   short: String(s.length + 1) })
    // Public tournaments and free-tier users skip Powerups step
    if (!isPublic && !isFree) s.push({ id: 'powerups', label: 'Powerups', short: String(s.length + 1) })
    return s
  }, [isPublic, isFree, basicInfo.isLeague])

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
    const id = steps[step]?.id
    if (id === 'basics' && !basicInfo.name.trim()) return 'Tournament name is required.'
    if (id === 'rounds') {
      for (const r of rounds.slice(0, basicInfo.numRounds)) {
        if (!r.courseId) return `Please select a course for Round ${r.roundNumber}.`
      }
    }
    return ''
  }

  function validateAll(): string {
    if (!basicInfo.name.trim()) return 'Tournament name is required.'
    if (basicInfo.isLeague) return ''
    for (const r of rounds.slice(0, basicInfo.numRounds)) {
      if (!r.courseId) return `Please select a course for Round ${r.roundNumber}.`
    }
    return ''
  }

  // Derive tournament startDate/endDate from round dates: start = first round
  // (00:00 of that day), end = day after the last round (00:00) so the final
  // day still counts as "active". Returns YYYY-MM-DD strings the server parses
  // with new Date(). When no rounds carry a date, both are blank.
  function deriveTournamentDates(): { startDate: string; endDate: string } {
    const dates = rounds
      .slice(0, basicInfo.numRounds)
      .map((r) => r.date)
      .filter((d): d is string => !!d)
      .sort()
    if (dates.length === 0) return { startDate: '', endDate: '' }
    const last = new Date(dates[dates.length - 1] + 'T00:00:00Z')
    last.setUTCDate(last.getUTCDate() + 1)
    const dayAfter = last.toISOString().slice(0, 10)
    return { startDate: dates[0], endDate: dayAfter }
  }

  function handleNext() {
    if (imageUploading) {
      setError('Please wait for image upload to finish.')
      return
    }
    const err = validateStep()
    if (err) { setError(err); return }
    setError('')
    setStep((s) => s + 1)
  }

  function handleSubmit() {
    if (imageUploading) {
      setError('Please wait for image upload to finish.')
      return
    }
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
        const activeRounds = basicInfo.isLeague ? [] : rounds.slice(0, basicInfo.numRounds)
        const derived = basicInfo.isLeague
          ? { startDate: basicInfo.startDate, endDate: basicInfo.endDate }
          : deriveTournamentDates()
        const result = await createTournamentFromWizard({
          name: basicInfo.name,
          description: basicInfo.description,
          startDate: derived.startDate,
          endDate: derived.endDate,
          numRounds: basicInfo.isLeague ? 0 : basicInfo.numRounds,
          logoUrl: basicInfo.logoUrl,
          headerImageUrl: basicInfo.headerImageUrl,
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
          tournamentFormat,
          formatConfig: defaultFormatConfig(tournamentFormat),
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
        if (userTier === 'FREE') {
          router.push(`/tournaments/new/upgrade/${result.slug}`)
        } else {
          router.push(`/${result.slug}`)
        }
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

  // Map step id to content. Steps array drives ordering — Rounds is omitted for leagues,
  // Powerups is omitted for public tournaments and free-tier users.
  function renderStep() {
    switch (steps[step]?.id) {
      case 'type':
        return <StepTournamentType value={tournamentType} onChange={setTournamentType} />
      case 'basics':
        return <StepBasicInfo value={basicInfo} onChange={handleBasicInfoChange} isFree={isFree} userTier={userTier} tournamentType={tournamentType.tournamentType} parentRoundCount={renewalDefaults?.rounds.length} onUploadingChange={setImageUploading} />
      case 'rounds':
        return <StepRounds numRounds={basicInfo.numRounds} value={rounds} onChange={setRounds} isOpenRegistration={isPublic} />
      case 'format':
        return <StepFormat value={tournamentFormat} onChange={setTournamentFormat} isFree={isFree} />
      case 'powerups':
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
          {renewalDefaults ? 'Renew Tournament/League' : 'Create Tournament/League'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Step {step + 1} of {steps.length}</p>
        {renewalDefaults && (
          <p className="text-xs text-muted-foreground mt-1">
            Pre-filled from previous tournament. Update dates and details as needed.
          </p>
        )}
      </div>

      {/* Step progress */}
      <p className="text-xs text-muted-foreground mb-2 sm:hidden">
        Step {step + 1} of {steps.length} — {steps[step].label}
      </p>
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
              {i < step ? '\u2713' : s.short}
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
            disabled={isPending || imageUploading}
            style={{ backgroundColor: 'var(--color-primary)' }}
            className="text-white min-w-32"
          >
            {isPending ? 'Creating...' : imageUploading ? 'Uploading…' : renewalDefaults ? 'Renew Tournament' : 'Create Tournament'}
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
