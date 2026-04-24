'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { LogOut, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function ProfileDropdown({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null
  initials: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
      >
        <Avatar size="sm">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="text-muted-foreground font-medium text-xs">Profile</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-popover shadow-md py-1 z-50"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <User className="w-4 h-4 text-muted-foreground" />
            Profile
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              role="menuitem"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
