'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { isMarketingRoute } from '@/lib/marketing-routes'

export function NavShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  // The marketing surface floats the nav transparent over the green ground.
  // Previously this listed only /auth/login, so /auth/signup rendered the
  // application's white nav on top of a green page.
  const isDarkPage = isMarketingRoute(pathname)

  useEffect(() => {
    if (!isDarkPage) return
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [isDarkPage])

  // The dark-page branch is exactly the marketing surface, so it carries the
  // marketing world: deep green settling in behind a gold hairline, never the
  // application's white glass. See DESIGN.md.
  const solidClass = 'pt-safe bg-white border-b border-border sticky top-0 z-50'
  const glassScrolledClass = 'marketing pt-safe sticky top-0 z-50 transition-all duration-300 backdrop-blur-xl bg-[var(--mk-green-deep)]/92 border-b border-[var(--mk-rule-gold)]'
  const glassTransparentClass = 'marketing pt-safe sticky top-0 z-50 transition-all duration-300 bg-transparent border-b border-transparent'

  const className = !isDarkPage
    ? solidClass
    : scrolled ? glassScrolledClass : glassTransparentClass

  return (
    <header className={className} suppressHydrationWarning>
      {children}
    </header>
  )
}
