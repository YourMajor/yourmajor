'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { isMarketingRoute } from '@/lib/marketing-routes'

const LINKS = [
  { href: '/terms', label: 'Terms of Use' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/feedback', label: 'Feedback' },
]

/* Marketing routes also point at the clubhouse: the live public-tournament
   shelf is the one destination the legal links don't cover. */
const MARKETING_LINKS = [{ href: '/#clubhouse', label: 'Tournaments' }, ...LINKS]

/**
 * Route-aware for the same reason NavShell is: the footer sits outside the
 * `.marketing` root and would otherwise render the application's navy strip
 * under the green page.
 *
 * On marketing routes it is the closing set piece at every breakpoint: a
 * gold hairline draws itself across the top, and an oversized Caslon
 * wordmark rises out of the deep green at page end. Both are decoration, so
 * gating them behind the viewport is allowed; the links never animate. On
 * app routes the modest desktop-only footer is untouched.
 */
export function Footer() {
  const marketing = isMarketingRoute(usePathname())
  const reduce = useReducedMotion()

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

  return (
    <footer className="marketing overflow-hidden" style={{ background: 'var(--mk-green-deep)' }}>
      {/* The hairline draws itself across the page. */}
      <motion.div
        aria-hidden
        className="h-px w-full origin-left"
        style={{ background: 'var(--mk-gold)' }}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />

      <div className="mk-container flex flex-col gap-10 pt-12 pb-6 lg:pt-16">
        <nav className="flex flex-wrap items-center gap-x-8 gap-y-3" aria-label="Footer">
          {MARKETING_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] transition-colors hover:opacity-100 pointer-coarse:py-3"
              style={{ color: 'var(--mk-text-subtle)' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* The wordmark rises out of the ground letter by letter, like a
            gallery board turning over. Ghost ink on deep green: texture, not
            a heading, hence aria-hidden. Letters start visible (offset only)
            per the animate-from-visible contract. */}
        <p
          aria-hidden
          className="select-none overflow-hidden text-center uppercase"
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: 'clamp(3rem, 13vw, 11rem)',
            lineHeight: 0.8,
            letterSpacing: '0.02em',
            color: 'var(--mk-bone)',
            opacity: 0.13,
            marginBottom: '-0.18em',
          }}
        >
          {'YourMajor'.split('').map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ y: '0.4em' }}
              whileInView={{ y: '0em' }}
              viewport={{ once: true, amount: 0.4 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }
              }
            >
              {ch}
            </motion.span>
          ))}
        </p>
      </div>
    </footer>
  )
}
