'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, User, MoreHorizontal, X, LogOut, CreditCard, Tag } from 'lucide-react'

const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '#more', label: 'More', icon: MoreHorizontal },
] as const

const MORE_LINKS: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: '/pricing', label: 'Pricing', icon: Tag },
  { href: '/billing', label: 'Billing', icon: CreditCard },
]

export function BottomTabBar() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      {/* More sheet overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl border-t border-border pb-[env(safe-area-inset-bottom,0px)] animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="font-heading font-semibold text-base">More</h3>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-2 -mr-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="px-2 pb-4">
              {MORE_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <link.icon className="w-5 h-5 text-muted-foreground" />
                  {link.label}
                </Link>
              ))}
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sign out
                </button>
              </form>
            </nav>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-md border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-16">
          {TABS.map((tab) => {
            const isMore = tab.href === '#more'
            const isActive = !isMore && (pathname === tab.href || pathname.startsWith(tab.href + '/'))
            const Icon = tab.icon

            if (isMore) {
              return (
                <button
                  key={tab.label}
                  onClick={() => setMoreOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] text-muted-foreground"
                  aria-label={tab.label}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] font-medium">{tab.label}</span>
                </button>
              )
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
                aria-label={tab.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+4px)] w-1 h-1 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
