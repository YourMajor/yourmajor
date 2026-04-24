'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Crown, Zap, Trophy, Pencil, Camera, ArrowLeft } from 'lucide-react'
import { CountUp } from '@/components/motion/CountUp'
import { AvatarCropDialog } from '@/components/profile/AvatarCropDialog'

type Tier = 'FREE' | 'PRO' | 'CLUB' | 'LEAGUE'

interface IdentityHeroProps {
  displayName: string
  avatarUrl: string | null
  tier: Tier
  handicap: number
  totalRounds: number
  avgVsPar: number | null
  tournamentBackRef?: string | null
  isEditing?: boolean
}

const TIER_LABEL: Record<Tier, string> = {
  LEAGUE: 'Tour',
  CLUB: 'Club',
  PRO: 'Pro',
  FREE: 'Free',
}

const TIER_TOKEN: Record<Tier, string> = {
  LEAGUE: 'var(--accent)',
  CLUB: 'var(--club)',
  PRO: 'var(--primary)',
  FREE: 'var(--border)',
}

export function IdentityHero({
  displayName,
  avatarUrl: initialAvatarUrl,
  tier,
  handicap,
  totalRounds,
  avgVsPar,
  tournamentBackRef,
  isEditing = false,
}: IdentityHeroProps) {
  const initials = displayName.charAt(0).toUpperCase()

  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be under 5 MB' })
      return
    }
    setMessage(null)
    setSelectedFile(file)
  }

  async function handleCropConfirm(blob: Blob) {
    setSelectedFile(null)
    setUploading(true)
    const formData = new FormData()
    formData.append('file', blob, 'avatar.jpg')
    try {
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error ?? 'Upload failed' })
      } else {
        // Cache-bust so the <img> refetches even when the URL path is unchanged
        setAvatarUrl(`${json.avatarUrl}?v=${Date.now()}`)
        setMessage({ type: 'success', text: 'Profile photo updated' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Upload failed. Please try again.' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleCropCancel() {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <section className="relative w-full overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 400px at 15% -5%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 55%),' +
            'radial-gradient(700px 350px at 95% 10%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 55%)',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-6 sm:pt-14 sm:pb-8">
        {(tournamentBackRef || isEditing) && (
          <div className="flex justify-start mb-6 gap-2 flex-wrap">
            {isEditing && (
              <Link
                href="/profile"
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-white transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Link>
            )}
            {tournamentBackRef && (
              <Link
                href={`/${tournamentBackRef}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-white transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Tournament
              </Link>
            )}
          </div>
        )}

        <div className="flex flex-col items-center">
          {/* Avatar — clickable upload target */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Change profile photo"
            className="relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-full transition-transform duration-200 hover:scale-[1.02]"
          >
            {/* Double gold ring: outer gold → white gap → inner gold → avatar */}
            <div
              className="rounded-full p-[4px]"
              style={{
                background:
                  'conic-gradient(from 140deg, color-mix(in oklab, var(--accent) 90%, white) 0deg, color-mix(in oklab, var(--accent) 60%, white) 120deg, color-mix(in oklab, var(--accent) 95%, black) 220deg, color-mix(in oklab, var(--accent) 70%, white) 360deg)',
              }}
            >
              <div className="rounded-full bg-white p-[5px]">
                <div
                  className="rounded-full p-[4px]"
                  style={{
                    background:
                      'conic-gradient(from 320deg, color-mix(in oklab, var(--accent) 85%, white) 0deg, color-mix(in oklab, var(--accent) 55%, white) 140deg, color-mix(in oklab, var(--accent) 95%, black) 240deg, color-mix(in oklab, var(--accent) 65%, white) 360deg)',
                  }}
                >
                  <div className="relative rounded-full bg-white">
                    <Avatar className="h-36 w-36 sm:h-44 sm:w-44">
                      <AvatarImage src={avatarUrl ?? undefined} sizes="(min-width: 640px) 176px, 144px" className="object-cover" />
                      <AvatarFallback
                        className="text-4xl sm:text-5xl font-heading font-bold"
                        style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                      <Camera className="w-7 h-7 text-white" />
                    </span>
                    {uploading && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55">
                        <span className="text-white text-xs font-medium">Uploading…</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="sr-only"
            onChange={handleFileChange}
          />

          <p className="mt-3 text-xs text-muted-foreground">
            {uploading ? 'Uploading…' : 'Click to change photo'}
          </p>

          {message && (
            <p className={`mt-1 text-xs ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
              {message.text}
            </p>
          )}

          <h1
            className="mt-4 font-heading font-semibold text-foreground text-center"
            style={{
              fontSize: 'clamp(1.875rem, 5vw, 3rem)',
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
            }}
          >
            {displayName}
          </h1>

          <TierBadge tier={tier} />
        </div>

        <div className="mt-10 sm:mt-12 grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto">
          <HeroStat label="Handicap" value={handicap} decimals={handicap % 1 === 0 ? 0 : 1} />
          <HeroStat label="Rounds" value={totalRounds} />
          <HeroStat
            label="Avg vs Par"
            value={avgVsPar ?? 0}
            decimals={1}
            signed={avgVsPar !== null}
            muted={avgVsPar === null}
            placeholder={avgVsPar === null ? '—' : undefined}
          />
        </div>

        {/* Edit profile toggle — hidden when already editing */}
        {!isEditing && (
          <div className="mt-10 flex justify-center">
            <Link
              href="/profile?edit=1#profile-edit"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 backdrop-blur-sm px-5 py-2 text-sm font-medium text-foreground/90 hover:bg-white transition-all shadow-sm hover:shadow-md"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit profile
            </Link>
          </div>
        )}
      </div>

      <AvatarCropDialog
        file={selectedFile}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </section>
  )
}

function TierBadge({ tier }: { tier: Tier }) {
  if (tier === 'FREE') {
    return (
      <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 backdrop-blur-sm px-3 py-1 text-[11px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
        {TIER_LABEL[tier]}
      </span>
    )
  }
  const Icon = tier === 'LEAGUE' ? Crown : tier === 'CLUB' ? Trophy : Zap
  const token = TIER_TOKEN[tier]
  const chipStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, color-mix(in oklab, ${token} 10%, white) 0%, color-mix(in oklab, ${token} 26%, white) 100%)`,
    borderColor: `color-mix(in oklab, ${token} 35%, transparent)`,
    color: `color-mix(in oklab, ${token} 45%, black)`,
  }

  return (
    <span
      className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] font-semibold"
      style={chipStyle}
    >
      <Icon className="w-3 h-3" style={{ color: token }} />
      {TIER_LABEL[tier]}
    </span>
  )
}

interface HeroStatProps {
  label: string
  value: number
  decimals?: number
  signed?: boolean
  muted?: boolean
  placeholder?: string
}

function HeroStat({ label, value, decimals = 0, signed = false, muted = false, placeholder }: HeroStatProps) {
  return (
    <div className="text-center">
      <div
        className={`font-heading font-semibold tabular-nums ${muted ? 'text-muted-foreground/60' : 'text-foreground'}`}
        style={{
          fontSize: 'clamp(2rem, 5.5vw, 3.25rem)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        {placeholder ?? <CountUp to={value} decimals={decimals} signed={signed} />}
      </div>
      <div className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
        {label}
      </div>
    </div>
  )
}
