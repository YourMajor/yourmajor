'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Trophy, Swords, ImageIcon, Crown, Settings, Pencil, Home } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PastChampion } from '@/lib/tournament-chain'

interface TournamentMenuProps {
  slug: string
  tournamentName: string
  headerImage: string | null
  showAdmin: boolean
  showRegister: boolean
  isLoggedIn: boolean
  isRegistered: boolean
  powerupsEnabled: boolean
  status: string
  champions?: PastChampion[]
}

export function TournamentMenu({
  slug,
  tournamentName,
  headerImage,
  showAdmin,
  showRegister,
  isLoggedIn,
  isRegistered,
  powerupsEnabled,
  status,
  champions = [],
}: TournamentMenuProps) {
  const [open, setOpen] = useState(false)

  const navLinks = [
    ...(status === 'ACTIVE' && isRegistered ? [{ href: `/${slug}/play`, label: 'Live Scoring', icon: Pencil }] : []),
    { href: `/${slug}`, label: 'Leaderboard', icon: Trophy },
    ...(powerupsEnabled ? [{ href: `/${slug}/draft`, label: 'Powerups', icon: Swords }] : []),
    { href: `/${slug}/gallery`, label: 'Gallery', icon: ImageIcon },
    { href: `/${slug}/players`, label: 'Players', icon: Trophy, disabled: true },
    ...(showAdmin ? [{ href: `/${slug}/admin`, label: 'Settings', icon: Settings }] : []),
  ]

  return (
    <>
      {/* Menu trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
        <span className="hidden sm:inline">Menu</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed top-0 right-0 z-[65] h-full w-80 max-w-[85vw] bg-background shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header image area (if uploaded) */}
        {headerImage ? (
          <div className="relative shrink-0 h-40 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={headerImage}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-4 right-12">
              <p className="text-white font-heading font-bold text-lg leading-tight drop-shadow">
                {tournamentName}
              </p>
            </div>
            {/* Close button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 text-white/80 hover:text-white hover:bg-black/50 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between">
            <p className="font-heading font-bold text-lg text-foreground">{tournamentName}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              if (link.disabled) {
                return (
                  <div
                    key={link.label}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground/50 cursor-not-allowed"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{link.label}</span>
                    <span className="ml-auto text-[9px] uppercase tracking-wider font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Soon</span>
                  </div>
                )
              }
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-muted transition-colors"
                >
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Past Champions */}
          {champions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border space-y-3 px-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Past Champions</p>
              {champions.map((c, i) => {
                const vsParLabel = c.grossVsPar === null ? '' : c.grossVsPar === 0 ? 'E' : c.grossVsPar > 0 ? `+${c.grossVsPar}` : `${c.grossVsPar}`
                return (
                  <Link
                    key={i}
                    href={`/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-muted transition-colors group"
                  >
                    <div className="relative shrink-0">
                      <div className="rounded-full p-[3px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600">
                        <Avatar className="h-10 w-10 ring-2 ring-background">
                          {c.championAvatarUrl && <AvatarImage src={c.championAvatarUrl} />}
                          <AvatarFallback className="text-xs font-bold">
                            {c.championName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-yellow-400 text-yellow-900 ring-2 ring-background">
                        <Crown className="w-2.5 h-2.5" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-foreground">{c.championName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.year === new Date().getFullYear() && c.startDate
                          ? `${c.tournamentName} — ${new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : `${c.tournamentName}${c.year ? ` (${c.year})` : ''}`}
                        {c.grossTotal !== null && (
                          <span className="ml-1.5">
                            — <span className="font-bold text-foreground">{c.grossTotal}</span>
                            {vsParLabel && <span className="ml-0.5">({vsParLabel})</span>}
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Registration link */}
          {showRegister && (
            <div className="mt-4 pt-4 border-t border-border">
              <Link
                href={`/${slug}/register`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Register for Tournament
              </Link>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-border space-y-1">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-muted transition-colors text-sm font-medium"
          >
            <Home className="w-4 h-4 text-muted-foreground" />
            Back to YourMajor
          </Link>
          {!isLoggedIn && (
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
