'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isMarketingRoute } from '@/lib/marketing-routes'

const LINKS = [
  { href: '/terms', label: 'Terms of Use' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/feedback', label: 'Feedback' },
]

/**
 * Shared with the application, so it is route aware for the same reason
 * NavShell is: it sits outside the `.marketing` root and would otherwise
 * render the application's navy strip under the green marketing page.
 */
export function Footer() {
  const marketing = isMarketingRoute(usePathname())

  return (
    <footer
      className={`hidden lg:block ${marketing ? 'marketing' : 'footer-masters'}`}
      style={
        marketing
          ? { background: 'var(--mk-green-deep)', borderTop: '1px solid var(--mk-rule-gold)' }
          : undefined
      }
    >
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-6 px-6 py-4 text-xs">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="transition-colors"
            style={marketing ? { color: 'var(--mk-text-subtle)' } : undefined}
          >
            <span className={marketing ? 'hover:opacity-100' : 'text-white/60 hover:text-white'}>
              {link.label}
            </span>
          </Link>
        ))}
      </div>
    </footer>
  )
}
