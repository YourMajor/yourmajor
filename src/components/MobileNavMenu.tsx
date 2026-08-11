'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

const LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/#clubhouse', label: 'Tournaments' },
  { href: '/pricing', label: 'Pricing' },
]

export function MobileNavMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-3 -mr-3 rounded-lg text-muted-foreground hover:bg-foreground/10 transition-colors"
        aria-label="Menu"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown.
              Every colour here derives from --popover, never from the page.
              NavShell puts the `marketing` class on the header for marketing
              routes, and that scope rebinds --popover to bone while leaving
              --foreground near-white and --primary bone. So `text-foreground`
              rendered white-on-white here, and `text-primary` on the sign-in
              row was bone-on-bone and completely invisible. The popover pair
              is the only one guaranteed to match the surface in both the
              marketing scope and the app tokens. */}
          <div className="absolute top-full right-4 mt-1 z-50 w-48 rounded-md bg-popover text-popover-foreground shadow-xl border border-border py-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-popover-foreground hover:bg-popover-foreground/10 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="mx-3 my-1.5 border-t border-popover-foreground/15" />
            {/* Emphasis by weight, not hue: no single accent token reads on
                both a bone plate and a night plate. */}
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm font-bold text-popover-foreground hover:bg-popover-foreground/10 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
