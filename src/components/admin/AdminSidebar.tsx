'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Settings,
  PenLine,
  Users,
  Target,
  ShieldAlert,
  Trophy,
  Mail,
  Send,
} from 'lucide-react'

interface NavLink {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  show: boolean
  badge?: number
}

interface Props {
  slug: string
  tournamentName: string
  tournamentType: 'OPEN' | 'INVITE' | 'PUBLIC'
  isLeague: boolean
  powerupsEnabled: boolean
  vacancyCount?: number
}

export function AdminSidebar({ slug, tournamentName, tournamentType, isLeague, powerupsEnabled, vacancyCount = 0 }: Props) {
  const pathname = usePathname()
  const base = `/${slug}/admin`

  const links: NavLink[] = [
    { href: base, label: 'Overview', icon: LayoutDashboard, show: true },
    { href: `${base}/season`, label: 'Season', icon: Trophy, show: isLeague },
    { href: `${base}/communications`, label: 'Communications', icon: Send, show: isLeague },
    { href: `${base}/invites`, label: 'Invite Players', icon: Mail, show: tournamentType === 'INVITE' },
    { href: `${base}/setup`, label: 'Settings', icon: Settings, show: true },
    { href: `${base}/scores`, label: 'Manage Scores', icon: PenLine, show: !isLeague },
    { href: `${base}/groups`, label: 'Manage Groups', icon: Users, show: !isLeague && tournamentType !== 'PUBLIC', badge: vacancyCount },
    { href: `${base}/draft`, label: 'Draft & Powerups', icon: Target, show: powerupsEnabled },
    { href: `${base}/chat`, label: 'Chat Moderation', icon: ShieldAlert, show: true },
  ].filter((l) => l.show)

  const isActive = (href: string) => {
    if (href === base) return pathname === base
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <>
      {/* Mobile: horizontal scroll tab strip, sticky at top */}
      <nav
        aria-label="Admin sections"
        className="lg:hidden sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border"
      >
        <div className="overflow-x-auto">
          <ul className="flex gap-1 px-3 py-2 whitespace-nowrap">
            {links.map((link) => {
              const active = isActive(link.href)
              const Icon = link.icon
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    ].join(' ')}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.label}
                    {link.badge ? (
                      <span
                        aria-label={`${link.badge} action${link.badge === 1 ? '' : 's'} needed`}
                        className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold"
                      >
                        {link.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* Desktop: sticky vertical sidebar */}
      <aside
        aria-label="Admin sections"
        className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-border lg:bg-muted/20"
      >
        <div className="px-5 pt-6 pb-4 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Admin
          </p>
          <p className="mt-1 text-sm font-heading font-bold truncate" title={tournamentName}>
            {tournamentName}
          </p>
        </div>
        <ul className="space-y-1 p-3">
          {links.map((link) => {
            const active = isActive(link.href)
            const Icon = link.icon
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-foreground/80 hover:text-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{link.label}</span>
                  {link.badge ? (
                    <span
                      aria-label={`${link.badge} action${link.badge === 1 ? '' : 's'} needed`}
                      className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold"
                    >
                      {link.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="mt-auto px-5 py-4 border-t border-border">
          <Link
            href={`/${slug}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to tournament
          </Link>
        </div>
      </aside>
    </>
  )
}
