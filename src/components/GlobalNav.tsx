import Link from 'next/link'
import Image from 'next/image'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buttonVariants } from '@/components/ui/button-variants'
import { NavShell } from '@/components/NavShell'
import { MobileNavMenu } from '@/components/MobileNavMenu'
import { ProfileDropdown } from '@/components/ProfileDropdown'

const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Features', href: '/features' },
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
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image src="/logos/eagle-flags.svg" alt="" width={48} height={48} className="h-12 w-12" style={{ overflow: 'visible' }} />
            <span className="font-heading leading-none text-left">
              <span className="block text-sm font-normal text-primary uppercase" style={{ letterSpacing: '0.15em' }}>Your</span>
              <span className="block text-2xl font-black -mt-1.5 text-accent">MAJOR</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1 text-sm lg:text-base">
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
