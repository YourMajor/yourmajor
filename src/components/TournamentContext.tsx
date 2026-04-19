'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { PastChampion, LatestTournament } from '@/lib/tournament-chain'

export interface TournamentContextValue {
  slug: string
  tournamentId: string
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
  galleryImages: string[]
  champions: PastChampion[]
  hasVault: boolean
  hasSeason: boolean
  latestTournament: LatestTournament | null
}

const TournamentCtx = createContext<TournamentContextValue | null>(null)

export function TournamentProvider({ value, children }: { value: TournamentContextValue; children: ReactNode }) {
  return <TournamentCtx.Provider value={value}>{children}</TournamentCtx.Provider>
}

export function useTournament(): TournamentContextValue {
  const ctx = useContext(TournamentCtx)
  if (!ctx) throw new Error('useTournament must be used within a TournamentProvider')
  return ctx
}
