import Link from 'next/link'
import Image from 'next/image'
import { getUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buttonVariants } from '@/components/ui/button-variants'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const NAV_LINKS: { label: string; href: string }[] = []

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
    <header className="bg-white border-b border-border sticky top-0 z-50" suppressHydrationWarning>
      <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between relative">
        <Link href="/" className="flex items-center gap-3 shrink-0 md:absolute md:left-1/2 md:-translate-x-1/2">
          <img src="/logos/eagle-flags.svg" alt="" className="h-14 w-auto" style={{ overflow: 'visible' }} />
          <span className="font-heading text-3xl font-bold text-primary leading-none">
            Your<span className="text-accent">Major</span>
          </span>
        </Link>

        {user ? (
          /* Desktop nav — mobile navigation handled by BottomTabBar */
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/profile"
              className="ml-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <Avatar size="sm">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground font-medium text-xs">Profile</span>
            </Link>
            <form action="/api/auth/signout" method="POST" className="ml-1">
              <button
                type="submit"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
              >
                Sign out
              </button>
            </form>
          </nav>
        ) : (
          <Link
            href="/auth/login"
            className={buttonVariants({ size: 'sm' }) + ' bg-primary text-primary-foreground hover:bg-primary/90'}
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
