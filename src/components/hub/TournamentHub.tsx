'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { TournamentHeader } from './TournamentHeader'
import { NextRoundBanner } from './NextRoundBanner'
import { AdminBar } from './AdminBar'
import { Trophy, Pencil, Swords } from 'lucide-react'

// Stock golf course images (Unsplash, no people)
const STOCK_IMAGES = {
  leaderboard: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=600&h=300&fit=crop&q=80',
  scoring: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600&h=300&fit=crop&q=80',
  powerups: 'https://images.unsplash.com/photo-1592919505780-303950717480?w=600&h=300&fit=crop&q=80',
}

interface NextRound {
  roundNumber: number
  date: Date | null
}

interface Props {
  tournament: {
    id: string
    slug: string
    name: string
    description: string | null
    logo: string | null
    headerImage: string | null
    status: string
    primaryColor: string
    accentColor: string
    startDate: Date | null
    endDate: Date | null
    isOpenRegistration: boolean
    powerupsEnabled?: boolean
  }
  nextRound: NextRound | null
  totalHoles: number
  isAdmin: boolean
  isRegistered: boolean
  currentUserId: string | null
  currentPlayerHolesPlayed: number
  draftStatus?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | null
}

function ActionCard({
  href,
  image,
  icon: Icon,
  label,
  sublabel,
}: {
  href: string
  image: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  sublabel?: string | null
}) {
  return (
    <Link
      href={href}
      className="group relative block rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
    >
      {/* Background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        className="w-full h-32 sm:h-36 object-cover transition-transform duration-500 group-hover:scale-105"
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-2 border border-white/30">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <p className="text-base sm:text-lg font-heading font-bold text-white drop-shadow-lg">
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-white/70 mt-0.5">{sublabel}</p>
        )}
      </div>
    </Link>
  )
}

export function TournamentHub({
  tournament,
  nextRound,
  totalHoles,
  isAdmin,
  isRegistered,
  currentUserId,
  currentPlayerHolesPlayed,
  draftStatus,
}: Props) {
  const canScore = isRegistered && tournament.status === 'ACTIVE' && currentPlayerHolesPlayed < totalHoles
  const ctaButtonLabel = currentPlayerHolesPlayed > 0 ? 'Continue Scoring' : 'Enter Scores'
  const ctaSubtext = currentPlayerHolesPlayed > 0
    ? `${currentPlayerHolesPlayed} of ${totalHoles} holes`
    : null

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {isAdmin && <AdminBar slug={tournament.slug} tournamentId={tournament.id} status={tournament.status} powerupsEnabled={tournament.powerupsEnabled} />}

      <TournamentHeader
        name={tournament.name}
        logo={tournament.logo}
        headerImage={tournament.headerImage}
        status={tournament.status}
        startDate={tournament.startDate}
        endDate={tournament.endDate}
        slug={tournament.slug}
      />

      {/* Tournament description */}
      {tournament.description && (
        <div className="px-4 max-w-lg mx-auto text-center mb-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {tournament.description}
          </p>
        </div>
      )}

      {nextRound && (
        <NextRoundBanner
          roundNumber={nextRound.roundNumber}
          date={nextRound.date}
          status={tournament.status}
        />
      )}

      {/* Open registration CTA */}
      {!isRegistered && currentUserId && tournament.isOpenRegistration &&
        tournament.status !== 'ACTIVE' && tournament.status !== 'COMPLETED' && (
        <div className="mx-4 mb-6 p-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Join this tournament</p>
            <p className="text-xs text-muted-foreground mt-0.5">Registration is open. Sign up to compete.</p>
          </div>
          <Link href={`/${tournament.slug}/register`} className={buttonVariants({ size: 'sm' }) + ' shrink-0 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'}>
            Register
          </Link>
        </div>
      )}

      {/* Action cards on stock golf images */}
      <div className="px-4 space-y-3">
        {/* Leaderboard — always visible */}
        <ActionCard
          href={`/${tournament.slug}/leaderboard`}
          image={STOCK_IMAGES.leaderboard}
          icon={Trophy}
          label="Leaderboard"
        />

        {/* Two-column row for scoring + powerups */}
        <div className="grid grid-cols-2 gap-3">
          {canScore && (
            <ActionCard
              href={`/${tournament.slug}/play`}
              image={STOCK_IMAGES.scoring}
              icon={Pencil}
              label={ctaButtonLabel}
              sublabel={ctaSubtext}
            />
          )}

          {tournament.powerupsEnabled && draftStatus && draftStatus !== 'COMPLETED' && (
            <ActionCard
              href={`/${tournament.slug}/draft`}
              image={STOCK_IMAGES.powerups}
              icon={Swords}
              label={draftStatus === 'ACTIVE' ? 'Join Draft' : 'Draft'}
              sublabel={draftStatus === 'ACTIVE' ? 'Live now' : null}
            />
          )}

          {tournament.powerupsEnabled && draftStatus === 'COMPLETED' && (
            <ActionCard
              href={`/${tournament.slug}/draft`}
              image={STOCK_IMAGES.powerups}
              icon={Swords}
              label="Powerups"
            />
          )}
        </div>
      </div>
    </div>
  )
}
