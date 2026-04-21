'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTournament } from '@/components/TournamentContext'
import { TournamentNavBar } from './TournamentNavBar'
import { TournamentBottomBar } from './TournamentBottomBar'
import type { PastChampion } from '@/lib/tournament-chain'

interface TournamentShellProps {
  slug: string
  tournamentName: string
  logo: string | null
  headerImage: string | null
  primaryColor: string
  accentColor: string
  status: string
  startDate: string | null
  endDate: string | null
  isLoggedIn: boolean
  isRegistered: boolean
  avatarUrl: string | null
  initials: string
  showAdmin: boolean
  showRegister: boolean
  powerupsEnabled: boolean
  galleryImages?: string[]
  champions?: PastChampion[]
  hasVault?: boolean
  canLeave?: boolean
  children: React.ReactNode
}

export function TournamentShell({
  slug,
  tournamentName,
  logo,
  headerImage,
  primaryColor,
  accentColor,
  status,
  startDate,
  endDate,
  isLoggedIn,
  isRegistered,
  avatarUrl,
  initials,
  showAdmin,
  showRegister,
  powerupsEnabled,
  galleryImages = [],
  champions = [],
  hasVault = false,
  canLeave = false,
  children,
}: TournamentShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { latestTournament, hasSeason } = useTournament()

  return (
    <>
      <TournamentNavBar
        slug={slug}
        tournamentName={tournamentName}
        logo={logo}
        headerImage={headerImage}
        primaryColor={primaryColor}
        accentColor={accentColor}
        status={status}
        startDate={startDate}
        endDate={endDate}
        isLoggedIn={isLoggedIn}
        isRegistered={isRegistered}
        avatarUrl={avatarUrl}
        initials={initials}
        showAdmin={showAdmin}
        showRegister={showRegister}
        powerupsEnabled={powerupsEnabled}
        galleryImages={galleryImages}
        champions={champions}
        hasVault={hasVault}
        externalMenuOpen={menuOpen}
        onExternalMenuChange={setMenuOpen}
      />

      {latestTournament && (
        <div style={{ backgroundColor: 'var(--color-accent)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link
              href={`/${latestTournament.slug}`}
              className="flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-accent-foreground, white)' }}
            >
              There is a new tournament available: {latestTournament.name}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      <div className="pb-20 md:pb-0">
        {children}
      </div>

      <TournamentBottomBar
        slug={slug}
        isRegistered={isRegistered}
        isLoggedIn={isLoggedIn}
        status={status}
        hasSeason={hasSeason}
        onMenuOpen={() => setMenuOpen(true)}
      />
    </>
  )
}
