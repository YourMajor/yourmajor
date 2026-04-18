'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trophy, Pencil, ImageIcon, Menu } from 'lucide-react'

interface TournamentBottomBarProps {
  slug: string
  isRegistered: boolean
  status: string
  onMenuOpen: () => void
}

export function TournamentBottomBar({
  slug,
  isRegistered,
  status,
  onMenuOpen,
}: TournamentBottomBarProps) {
  const pathname = usePathname()
  const isActive = status === 'ACTIVE'
  const canScore = isRegistered && isActive

  const tabs = [
    { href: `/${slug}`, label: 'Leaderboard', icon: Trophy },
    ...(canScore ? [{ href: `/${slug}/play`, label: 'Score', icon: Pencil }] : []),
    { href: `/${slug}/gallery`, label: 'Gallery', icon: ImageIcon },
    { href: '#menu', label: 'Menu', icon: Menu },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t"
      style={{
        backgroundColor: 'var(--color-primary)',
        borderColor: 'color-mix(in oklch, var(--color-primary), white 15%)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isMenu = tab.href === '#menu'
          const isCurrent = !isMenu && (tab.href.endsWith('/play') || tab.href.endsWith('/gallery')
            ? pathname === tab.href
            : pathname === tab.href || pathname === tab.href + '/leaderboard')
          const Icon = tab.icon

          if (isMenu) {
            return (
              <button
                key={tab.label}
                onClick={onMenuOpen}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] text-white/60 hover:text-white transition-colors"
                aria-label={tab.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] transition-colors ${
                isCurrent ? 'text-white' : 'text-white/60 hover:text-white'
              }`}
              aria-label={tab.label}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isCurrent && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
