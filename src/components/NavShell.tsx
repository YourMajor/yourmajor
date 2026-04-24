'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

export function NavShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  // Pages with dark backgrounds where nav should float transparent
  const isDarkPage = pathname === '/' || pathname === '/auth/login' || pathname === '/pricing' || pathname === '/features'

  useEffect(() => {
    if (!isDarkPage) return
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [isDarkPage])

  const solidClass = 'bg-white border-b border-border sticky top-0 z-50'
  const glassScrolledClass = 'sticky top-0 z-50 transition-all duration-300 bg-white/90 backdrop-blur-xl saturate-150 border-b border-black/8 shadow-sm'
  const glassTransparentClass = 'sticky top-0 z-50 transition-all duration-300 bg-transparent border-b border-transparent'

  const className = !isDarkPage
    ? solidClass
    : scrolled ? glassScrolledClass : glassTransparentClass

  return (
    <header className={className} suppressHydrationWarning>
      {children}
    </header>
  )
}
