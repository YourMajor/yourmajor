'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorDonutPicker } from '@/components/ui/color-donut-picker'
import { TIER_LIMITS } from '@/lib/tiers'
import { createClient } from '@/utils/supabase/client'

export type BasicInfoState = {
  name: string
  description: string
  isLeague: boolean
  leagueEndDate: string
  startDate: string
  endDate: string
  registrationDeadline: string
  numRounds: number
  // Image fields are uploaded directly to Supabase Storage from the browser —
  // Server Actions can't accept >4.5 MB payloads (Vercel edge limit), so we
  // never round-trip image bytes through the action.
  logoPreview: string | null
  logoUrl: string | null
  headerPreview: string | null
  headerImageUrl: string | null
  primaryColor: string
  accentColor: string
}

interface Props {
  value: BasicInfoState
  onChange: (v: BasicInfoState) => void
  isFree?: boolean
  userTier?: 'FREE' | 'PRO' | 'CLUB' | 'LEAGUE'
  tournamentType?: 'PUBLIC' | 'OPEN' | 'INVITE'
  // Round count of the parent tournament when this is a renewal — lets a
  // user keep their existing N rounds even if their current tier's
  // maxRounds is now lower (e.g. PRO went 4→2 in the 2026-04-26 ship).
  parentRoundCount?: number
  // Surfaces upload-in-progress to the wizard so submit can be gated.
  onUploadingChange?: (uploading: boolean) => void
}

const MAX_LOGO_MB = 10
const MAX_HEADER_MB = 10

export function StepBasicInfo({ value, onChange, isFree = false, userTier = 'FREE', tournamentType, parentRoundCount, onUploadingChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const headerFileRef = useRef<HTMLInputElement>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [headerUploading, setHeaderUploading] = useState(false)

  function set<K extends keyof BasicInfoState>(key: K, val: BasicInfoState[K]) {
    onChange({ ...value, [key]: val })
  }

  function setUploading(kind: 'logo' | 'header', v: boolean) {
    if (kind === 'logo') setLogoUploading(v)
    else setHeaderUploading(v)
    // Tell the wizard whether *any* upload is still pending. Use the
    // post-update state values to compute, since the React setters above
    // are async with respect to this call.
    const logoBusy = kind === 'logo' ? v : logoUploading
    const headerBusy = kind === 'header' ? v : headerUploading
    onUploadingChange?.(logoBusy || headerBusy)
  }

  async function handleLogo(file: File | null) {
    setLogoError(null)
    if (!file) {
      onChange({ ...value, logoPreview: null, logoUrl: null })
      return
    }
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      setLogoError(`Logo must be under ${MAX_LOGO_MB} MB.`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    // Show the local preview immediately while the upload runs in the
    // background — the user gets visual feedback without waiting for the
    // network.
    const localPreview = URL.createObjectURL(file)
    onChange({ ...value, logoPreview: localPreview, logoUrl: null })

    setUploading('logo', true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${crypto.randomUUID()}.${ext}`
      const supabase = createClient()
      const { error } = await supabase.storage.from('logos').upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      onChange({ ...value, logoPreview: data.publicUrl, logoUrl: data.publicUrl })
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : 'Upload failed. Please try again.')
      if (fileRef.current) fileRef.current.value = ''
      onChange({ ...value, logoPreview: null, logoUrl: null })
    } finally {
      URL.revokeObjectURL(localPreview)
      setUploading('logo', false)
    }
  }

  async function handleHeaderImage(file: File | null) {
    setHeaderError(null)
    if (!file) {
      onChange({ ...value, headerPreview: null, headerImageUrl: null })
      return
    }
    if (file.size > MAX_HEADER_MB * 1024 * 1024) {
      setHeaderError(`Header image must be under ${MAX_HEADER_MB} MB.`)
      if (headerFileRef.current) headerFileRef.current.value = ''
      return
    }

    const localPreview = URL.createObjectURL(file)
    onChange({ ...value, headerPreview: localPreview, headerImageUrl: null })

    setUploading('header', true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `headers/${crypto.randomUUID()}.${ext}`
      const supabase = createClient()
      const { error } = await supabase.storage.from('logos').upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      onChange({ ...value, headerPreview: data.publicUrl, headerImageUrl: data.publicUrl })
    } catch (e) {
      setHeaderError(e instanceof Error ? e.message : 'Upload failed. Please try again.')
      if (headerFileRef.current) headerFileRef.current.value = ''
      onChange({ ...value, headerPreview: null, headerImageUrl: null })
    } finally {
      URL.revokeObjectURL(localPreview)
      setUploading('header', false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tournament/League Name *</Label>
            <Input
              id="name"
              value={value.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={value.isLeague ? 'e.g. Wednesday Night League' : 'e.g. The Masters Weekend'}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <textarea
              id="description"
              value={value.description}
              onChange={(e) => {
                if (e.target.value.length <= 250) set('description', e.target.value)
              }}
              placeholder={value.isLeague ? 'Tell members what this league is about...' : 'Tell players what this tournament is about...'}
              rows={3}
              maxLength={250}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{value.description.length}/250</p>
            {tournamentType === 'PUBLIC' && (
              <p className="text-xs text-muted-foreground">
                Public tournaments are visible to all users. Please keep names and descriptions appropriate.
              </p>
            )}
          </div>

          {/* League toggle */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Is this a league?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Leagues run on a recurring schedule without fixed start/end dates
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !value.isLeague
                onChange({
                  ...value,
                  isLeague: next,
                  startDate: next ? '' : value.startDate,
                  endDate: next ? '' : value.endDate,
                  numRounds: next ? 1 : value.numRounds,
                })
              }}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                value.isLeague ? 'bg-[var(--color-primary)]' : 'bg-muted'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                value.isLeague ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>

          {value.isLeague ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="leagueEndDate">League End Date</Label>
                <Input
                  id="leagueEndDate"
                  type="date"
                  value={value.leagueEndDate}
                  onChange={(e) => set('leagueEndDate', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">When the league season ends. A champion will be crowned and the league moves to history.</p>
              </div>
              <p className="text-xs text-muted-foreground">Event dates are set per-event. Each event in the season will have its own date.</p>
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                <p className="text-sm font-medium text-foreground">League schedule</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You&apos;ll be able to create your league schedule once setup is complete.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="numRounds">Number of Rounds</Label>
                {isFree ? (
                  <div>
                    <Input id="numRounds" value="1 Round" disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground mt-1">Multi-round tournaments require Pro or Tour</p>
                  </div>
                ) : (
                  <select
                    id="numRounds"
                    value={value.numRounds}
                    onChange={(e) => set('numRounds', parseInt(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    {Array.from({ length: Math.min(Math.max(TIER_LIMITS[userTier].maxRounds, parentRoundCount ?? 0), 7) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} Round{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-muted-foreground">
                  You&apos;ll set the date for each round on the next step. Tournament start and end are derived from those dates.
                </p>
              </div>

              {tournamentType === 'INVITE' && (
                <div className="space-y-2">
                  <Label htmlFor="registrationDeadline">Registration Deadline</Label>
                  <Input
                    id="registrationDeadline"
                    type="date"
                    value={value.registrationDeadline}
                    onChange={(e) => set('registrationDeadline', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Last day players can register. Leave blank for no deadline.</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className={isFree ? 'opacity-60' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Branding
            {isFree && <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Pro / Tour</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFree ? (
            <p className="text-sm text-muted-foreground">Custom branding, logos, and colors require Pro or Tour. <Link href="/pricing" className="underline text-[var(--color-primary)]">Upgrade</Link></p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Logo <span className="text-muted-foreground font-normal">(optional)</span></Label>
                {value.logoPreview && (
                  <Image src={value.logoPreview} alt="Logo preview" width={48} height={48} unoptimized className="h-12 object-contain mb-1" />
                )}
                <Input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  disabled={logoUploading}
                  onChange={(e) => handleLogo(e.target.files?.[0] ?? null)}
                />
                {logoError
                  ? <p className="text-xs text-destructive">{logoError}</p>
                  : logoUploading
                    ? <p className="text-xs text-muted-foreground">Uploading…</p>
                    : <p className="text-xs text-muted-foreground">PNG, JPG, or SVG · Max {MAX_LOGO_MB} MB</p>
                }
              </div>

              <div className="space-y-2">
                <Label>Header Image <span className="text-muted-foreground font-normal">(optional — displays edge-to-edge)</span></Label>
                {value.headerPreview && (
                  <Image src={value.headerPreview} alt="Header preview" width={800} height={96} unoptimized className="w-full h-24 object-cover rounded-md mb-1" />
                )}
                <Input
                  ref={headerFileRef}
                  type="file"
                  accept="image/*"
                  disabled={headerUploading}
                  onChange={(e) => handleHeaderImage(e.target.files?.[0] ?? null)}
                />
                {headerError
                  ? <p className="text-xs text-destructive">{headerError}</p>
                  : headerUploading
                    ? <p className="text-xs text-muted-foreground">Uploading…</p>
                    : <p className="text-xs text-muted-foreground">Wide landscape image recommended · Max {MAX_HEADER_MB} MB</p>
                }
              </div>

              <ColorDonutPicker
                primaryColor={value.primaryColor}
                accentColor={value.accentColor}
                onPrimaryChange={(c) => set('primaryColor', c)}
                onAccentChange={(c) => set('accentColor', c)}
                onPairChange={(primary, accent) => onChange({ ...value, primaryColor: primary, accentColor: accent })}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
