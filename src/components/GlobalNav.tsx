import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buttonVariants } from '@/components/ui/button-variants'
import { NavShell } from '@/components/NavShell'
import { NavUnderline } from '@/components/NavUnderline'
import { MobileNavMenu } from '@/components/MobileNavMenu'
import { ProfileDropdown } from '@/components/ProfileDropdown'

const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Features', href: '/#features' },
  { label: 'Tournaments', href: '/#clubhouse' },
  { label: 'Pricing', href: '/pricing' },
]

export async function GlobalNav() {
  const user = await getUser()

  let avatarUrl: string | null = null
  let initials = '?'

  if (user) {
    const profile = await prisma.playerProfile.findUnique({
      where: { userId: user.id },
      select: { avatar: true, displayName: true },
    })
    avatarUrl = profile?.avatar ?? user.image ?? null
    const name = profile?.displayName ?? user.name ?? user.email.split('@')[0]
    initials = name
      .split(' ')
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <NavShell>
      <div className="max-w-5xl lg:max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Left: Logo + nav links */}
        <div className="flex items-center gap-5">
          {/* mk-logo classes are inert outside .marketing; NavShell adds the
              scope on marketing routes, so the app nav renders exactly as
              before while the marketing nav gets the photo-safe drop shadow
              and hover flair (globals.css). The badge is inline (ink-gold
              rings, user-adopted) so the hover delight can play: a ball
              rolls in from the left and drops into the rings like a putt
              into the cup. The ball is invisible at rest and everywhere
              outside .marketing. */}
          {/* Logged in, the logo goes straight to the dashboard: '/' would
              only bounce there through a server redirect, and the hard hop
              cut the putt animation short. */}
          <Link href={user ? '/dashboard' : '/'} className="mk-logo flex items-center gap-2.5 shrink-0">
            <svg viewBox="0 0 512 512" className="h-12 w-12" aria-hidden>
              <circle cx="256" cy="256" r="256" fill="#191f1b" />
              <circle cx="256" cy="256" r="190" fill="none" stroke="#c99c56" strokeWidth="32" />
              <circle cx="256" cy="256" r="148" fill="none" stroke="#c99c56" strokeWidth="32" />
              <circle className="mk-logo-ball" cx="256" cy="256" r="58" fill="#f1ede2" />
            </svg>
            <span
              className="mk-logo-word leading-none text-left"
              style={{ fontFamily: 'var(--font-logo), Georgia, serif' }}
            >
              <span className="mk-logo-your block text-sm font-normal text-primary uppercase" style={{ letterSpacing: '0.15em' }}>Your</span>
              <span className="mk-logo-major block text-2xl font-black -mt-1.5 text-accent">MAJOR</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="relative hidden lg:flex items-center gap-1 text-sm lg:text-base">
            <NavUnderline />
            {(user ? NAV_LINKS : NAV_LINKS.filter(l => l.href !== '/dashboard')).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: Profile avatar or Sign in */}
        {user ? (
          <ProfileDropdown avatarUrl={avatarUrl} initials={initials} />
        ) : (
          <div className="flex items-center gap-1">
            {/* Desktop: inline links */}
            <nav className="hidden lg:flex items-center gap-1 text-sm lg:text-base">
              <Link
                href="/auth/login"
                className={buttonVariants({ size: 'sm' }) + ' bg-primary text-primary-foreground hover:bg-primary/90'}
              >
                Sign in
              </Link>
            </nav>
            {/* Mobile: hamburger menu */}
            <MobileNavMenu />
          </div>
        )}
      </div>
    </NavShell>
  )
}
