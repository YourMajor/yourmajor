'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

const LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
]

export function MobileNavMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 -mr-2 rounded-lg text-muted-foreground hover:bg-black/5 transition-colors"
        aria-label="Menu"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full right-4 mt-1 z-50 w-48 rounded-xl bg-white shadow-xl border border-border py-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="mx-3 my-1.5 border-t border-border" />
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm font-semibold text-primary hover:bg-muted transition-colors"
            >
              Sign in
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
