'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

interface NavLink {
  label: string
  href: string
}

interface Props {
  links: NavLink[]
  avatarUrl: string | null
  initials: string
}

export function MobileMenu({ links, initials }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Toggle menu"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-md z-50 py-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex items-center px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
              {initials}
            </span>
            Profile
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full text-left px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </>
  )
}
