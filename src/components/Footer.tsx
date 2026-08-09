'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { isMarketingRoute } from '@/lib/marketing-routes'

const LINKS = [
  { href: '/terms', label: 'Terms of Use' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/feedback', label: 'Feedback' },
]

// The marketing end plate carries motion and the poster image; loading it
// dynamically keeps that chunk off every authenticated page that renders
// this footer through the (main) layout.
const FooterEndPlate = dynamic(() => import('@/components/FooterEndPlate'))

/**
 * Route-aware for the same reason NavShell is: the footer sits outside the
 * `.marketing` root and would otherwise render the application's strip
 * under the green page. On marketing routes it is the closing set piece;
 * on app routes it is a quiet deep-green line of links.
 */
export function Footer() {
  const marketing = isMarketingRoute(usePathname())

  if (!marketing) {
    return (
      <footer className="footer-masters hidden lg:block">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-4 text-xs">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-white/60 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    )
  }

  return <FooterEndPlate />
}
