'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Menu, X, Trophy, Swords, ImageIcon, Pencil, User, Clock, Crown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTournament } from '@/components/TournamentContext'
import type { PastChampion } from '@/lib/tournament-chain'

interface TournamentNavBarProps {
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
  externalMenuOpen?: boolean
  onExternalMenuChange?: (open: boolean) => void
}

function isLightColor(color: string): boolean {
  const hex = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (hex) {
    const r = parseInt(hex[1], 16) / 255
    const g = parseInt(hex[2], 16) / 255
    const b = parseInt(hex[3], 16) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45
  }
  const rgb = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (rgb) {
    const r = parseInt(rgb[1]) / 255
    const g = parseInt(rgb[2]) / 255
    const b = parseInt(rgb[3]) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45
  }
  const oklch = color.match(/oklch\(\s*([\d.]+)/)
  if (oklch) return parseFloat(oklch[1]) > 0.6
  return false
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  REGISTRATION: 'Registration',
  ACTIVE: 'Live',
  COMPLETED: 'Final',
}

const MENU_DESCRIPTIONS: Record<string, string> = {
  'Live Scoring': 'Enter your scores hole-by-hole as you play the course.',
  'Leaderboard': 'See where every player stands in real time.',
  'Powerups': 'Draft powerups and deploy them against your opponents.',
  'Gallery': 'Photos and moments captured throughout the tournament.',
  'Admin Settings': 'Manage rounds, players, and tournament settings.',
  'Vault': 'Past champions and historical leaderboards from previous years.',
}

export function TournamentNavBar({
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
  externalMenuOpen,
  onExternalMenuChange,
}: TournamentNavBarProps) {
  const { latestTournament } = useTournament()
  const [internalMenuOpen, setInternalMenuOpen] = useState(false)
  const menuOpen = externalMenuOpen ?? internalMenuOpen
  const setMenuOpen = (open: boolean) => {
    setInternalMenuOpen(open)
    onExternalMenuChange?.(open)
  }
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoveredChampionIdx, setHoveredChampionIdx] = useState<number | null>(null)
  const isLive = status === 'ACTIVE'

  const light = isLightColor(primaryColor)
  const menuText = light ? 'text-gray-900' : 'text-white'
  const menuTextMuted = light ? 'text-gray-600' : 'text-white/60'
  const menuHover = light ? 'hover:text-gray-900' : 'hover:text-white'
  const menuBorder = light ? 'border-black/15' : 'border-white/15'

  const lightAccent = isLightColor(accentColor)
  const accentText = lightAccent ? 'text-gray-900' : 'text-white'
  const accentTextMuted = lightAccent ? 'text-gray-600' : 'text-white/70'

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const menuLinks = useMemo(() => [
    ...(status === 'ACTIVE' && isRegistered ? [{ href: `/${slug}/play`, label: 'Live Scoring', icon: Pencil }] : []),
    { href: `/${slug}`, label: 'Leaderboard', icon: Trophy },
    ...(powerupsEnabled ? [{ href: `/${slug}/draft`, label: 'Powerups', icon: Swords }] : []),
    { href: `/${slug}/gallery`, label: 'Gallery', icon: ImageIcon },
    ...(hasVault ? [{ href: `/${slug}/vault`, label: 'Vault', icon: Clock }] : []),
  ], [slug, status, isRegistered, powerupsEnabled, hasVault])

  // Determine which image to show on the right panel
  const fallbackImage = headerImage
  const hoveredChampion = hoveredChampionIdx !== null ? champions[hoveredChampionIdx] : null
  const currentImage = hoveredChampion
    ? (hoveredChampion.headerImage ?? fallbackImage)
    : hoveredIndex !== null
      ? (galleryImages[hoveredIndex % galleryImages.length] ?? fallbackImage)
      : fallbackImage
  const currentLabel = hoveredChampion
    ? hoveredChampion.tournamentName
    : hoveredIndex !== null ? menuLinks[hoveredIndex]?.label ?? null : null

  return (
    <>
      {/* ── Nav bar ── */}
      <header className="tournament-header sticky top-0 z-50">
        <div className="relative">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center">
            {/* LEFT */}
            <div className="flex items-center gap-1 sm:gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors text-xs sm:text-sm font-medium"
                aria-label="Open menu"
              >
                <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Menu</span>
              </button>
            </div>

            {/* CENTER */}
            <Link href={`/${slug}`} className="flex items-center gap-2.5 sm:gap-3 shrink-0 group">
              <div className="tournament-logo-badge w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-sm sm:text-base font-heading font-bold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                    {tournamentName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="font-heading text-sm sm:text-base font-bold text-white truncate max-w-[140px] sm:max-w-[220px] lg:max-w-none leading-tight">
                  {tournamentName}
                </span>
                <div className="flex items-center gap-1.5">
                  {startDate && (
                    <span className="text-[10px] sm:text-xs text-white/50">
                      {fmt(startDate)}{endDate ? ` \u2013 ${fmt(endDate)}` : ''}
                    </span>
                  )}
                  {isLive ? (
                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-white/90 uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live
                    </span>
                  ) : (
                    <span className="text-[9px] sm:text-[10px] font-semibold text-white/50 uppercase tracking-wider">
                      {STATUS_LABELS[status] ?? status}
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {/* RIGHT */}
            <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
              {isLoggedIn ? (
                <Link href={`/profile?ref=${slug}`} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                  <Avatar className="h-6 w-6 sm:h-7 sm:w-7">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
                    <AvatarFallback className="text-[9px] sm:text-xs font-bold bg-white/20 text-white">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-xs font-medium">Profile</span>
                </Link>
              ) : (
                <Link href="/auth/login" className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors text-xs sm:text-sm font-medium">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
              )}
            </div>
          </div>
          <div className="h-[2px]" style={{ backgroundColor: 'var(--color-accent)' }} />
        </div>
      </header>

      {/* ── Full-screen Masters-style menu ── */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className={`absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-lg z-10 ${menuTextMuted} ${menuHover} transition-colors`}
          aria-label="Close menu"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="h-full flex">
          {/* ── Left panel: primary color + navigation ── */}
          <div
            className="w-full md:w-[38%] lg:w-[35%] h-full flex flex-col px-6 sm:px-10 lg:px-14 pt-6 pb-8 overflow-y-auto"
            style={{ backgroundColor: primaryColor }}
          >
            {/* Tournament badge */}
            <div className="mb-8 sm:mb-10">
              <div className="flex items-center gap-3">
                {logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20" />
                )}
                <div>
                  <p className={`text-xs uppercase tracking-wider font-semibold ${menuTextMuted}`}>
                    {STATUS_LABELS[status] ?? status}
                  </p>
                  <p className={`font-heading font-bold text-lg leading-tight ${menuText}`}>
                    {tournamentName}
                  </p>
                  {startDate && (
                    <p className={`text-xs mt-0.5 ${menuTextMuted}`}>
                      {fmt(startDate)}{endDate ? ` \u2013 ${fmt(endDate)}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Nav links — large serif */}
            <nav className="flex-1">
              <ul className="space-y-1">
                {menuLinks.map((link, i) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className={`block py-2 font-heading text-xl sm:text-2xl font-bold transition-colors ${menuTextMuted}`}
                      style={hoveredIndex === i ? { color: accentColor } : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {showRegister && (
                <div className={`mt-6 pt-6 border-t ${menuBorder}`}>
                  <Link
                    href={`/${slug}/register`}
                    onClick={() => setMenuOpen(false)}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      light ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-white text-gray-900 hover:bg-white/90'
                    }`}
                  >
                    Register for Tournament
                  </Link>
                </div>
              )}

              {champions.length > 0 && (
                <div
                  className={`mt-6 pt-6 border-t ${menuBorder} space-y-2`}
                  onMouseLeave={() => setHoveredChampionIdx(null)}
                >
                  <p className={`text-[10px] uppercase tracking-wider font-bold ${menuTextMuted} mb-3`}>Past Champions</p>
                  {champions.map((c, i) => {
                    const vsParLabel = c.grossVsPar === null ? '' : c.grossVsPar === 0 ? 'E' : c.grossVsPar > 0 ? `+${c.grossVsPar}` : `${c.grossVsPar}`
                    return (
                      <Link
                        key={i}
                        href={`/${c.slug}`}
                        onClick={() => setMenuOpen(false)}
                        onMouseEnter={() => { setHoveredChampionIdx(i); setHoveredIndex(null) }}
                        className={`flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors ${light ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                      >
                        <div className="relative shrink-0">
                          <div className={`rounded-full p-[2px] ${light ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600' : 'bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500'}`}>
                            <Avatar className="h-10 w-10 ring-2 ring-background">
                              {c.championAvatarUrl && <AvatarImage src={c.championAvatarUrl} />}
                              <AvatarFallback className="text-xs font-bold bg-background text-foreground">
                                {c.championName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-yellow-400 text-yellow-900 ring-2 ring-background">
                            <Crown className="w-2.5 h-2.5" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-heading font-bold text-sm leading-tight ${menuText}`}>{c.championName}</p>
                          <p className={`text-[11px] ${menuTextMuted} mt-0.5`}>
                            {c.tournamentName}{c.year ? ` (${c.year})` : ''}
                            {c.grossTotal !== null && (
                              <span className="ml-1.5">
                                — <span className={`font-bold ${menuText}`}>{c.grossTotal}</span>
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
              {latestTournament && (
                <div className={`mt-6 pt-6 border-t ${menuBorder}`}>
                  <p className={`text-[10px] uppercase tracking-wider font-bold ${menuTextMuted} mb-3`}>Current Edition</p>
                  <Link
                    href={`/${latestTournament.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors`}
                    style={{ backgroundColor: accentColor, color: lightAccent ? '#111' : '#fff' }}
                  >
                    {latestTournament.name} &rarr;
                  </Link>
                </div>
              )}
            </nav>

            {/* Footer */}
            {showAdmin && (
              <div className={`mt-auto pt-4 border-t ${menuBorder} mb-4`}>
                <Link href={`/${slug}/admin`} onClick={() => setMenuOpen(false)} className={`text-sm font-medium ${menuTextMuted} ${menuHover} transition-colors`}>
                  Admin Settings
                </Link>
              </div>
            )}
            <div className={`${showAdmin ? '' : 'mt-auto'} pt-4 border-t ${menuBorder}`}>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Link href="/dashboard" onClick={() => setMenuOpen(false)} className={`text-sm font-medium ${menuTextMuted} ${menuHover} transition-colors`}>
                  Back to YourMajor
                </Link>
                {!isLoggedIn && (
                  <Link href="/auth/login" onClick={() => setMenuOpen(false)} className={`text-sm font-medium ${menuTextMuted} ${menuHover} transition-colors`}>
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ── Right panel: accent color + image + description ── */}
          <div
            className="hidden md:flex md:w-[62%] lg:w-[65%] h-full flex-col"
            style={{ backgroundColor: accentColor }}
          >
            <div className="flex-1 flex items-center p-8 lg:p-12 gap-8 lg:gap-10">
              {/* Text column — left of image */}
              <div
                className={`w-48 lg:w-56 shrink-0 transition-opacity duration-300 ${
                  currentLabel ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {currentLabel && (
                  <>
                    {hoveredChampion ? (
                      <>
                        <p className={`text-xs uppercase tracking-wider font-semibold mb-2 ${accentTextMuted}`}>
                          Past Champion{hoveredChampion.year ? ` \u2014 ${hoveredChampion.year}` : ''}
                        </p>
                        <h3 className={`font-heading text-2xl lg:text-3xl font-bold mb-3 ${accentText}`}>
                          {hoveredChampion.tournamentName}
                        </h3>
                        <p className={`text-sm leading-relaxed ${accentTextMuted}`}>
                          {hoveredChampion.championName} won with a gross {hoveredChampion.grossTotal ?? '—'}{hoveredChampion.grossVsPar !== null ? ` (${hoveredChampion.grossVsPar === 0 ? 'E' : hoveredChampion.grossVsPar > 0 ? `+${hoveredChampion.grossVsPar}` : hoveredChampion.grossVsPar})` : ''}.
                        </p>
                      </>
                    ) : (
                      <>
                        {currentLabel === 'Leaderboard' && startDate && (
                          <p className={`text-xs uppercase tracking-wider font-semibold mb-2 ${accentTextMuted}`}>
                            {fmt(startDate)}{endDate ? ` \u2013 ${fmt(endDate)}` : ''}
                          </p>
                        )}
                        {currentLabel === 'Gallery' && (
                          <p className={`text-xs uppercase tracking-wider font-semibold mb-2 ${accentTextMuted}`}>
                            {galleryImages.length} photo{galleryImages.length !== 1 ? 's' : ''}
                          </p>
                        )}
                        <h3 className={`font-heading text-2xl lg:text-3xl font-bold mb-3 ${accentText}`}>
                          {currentLabel}
                        </h3>
                        <p className={`text-sm leading-relaxed ${accentTextMuted}`}>
                          {MENU_DESCRIPTIONS[currentLabel] ?? ''}
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Image */}
              <div className="flex-1 h-full flex items-center justify-center">
                <div className="relative w-full h-full max-h-[75vh] rounded-lg overflow-hidden">
                  {currentImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentImage}
                      alt=""
                      className="w-full h-full object-cover transition-all duration-500 ease-out"
                      key={currentImage}
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{
                        background: `linear-gradient(135deg, ${primaryColor}, color-mix(in oklch, ${primaryColor}, black 30%))`,
                      }}
                    >
                      <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <pattern id="menu-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                            <circle cx="3" cy="3" r="1.5" fill="white" />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#menu-dots)" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
