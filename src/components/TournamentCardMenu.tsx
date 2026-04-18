'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'
import { DeleteTournamentButton } from '@/app/[slug]/admin/setup/DeleteTournamentButton'

interface Props {
  slug: string
  tournamentId: string
  tournamentName: string
  showRenew?: boolean
}

export function TournamentCardMenu({ slug, tournamentId, tournamentName, showRenew }: Props) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
        aria-label="More options"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-border bg-background shadow-lg py-1">
          <Link
            href={`/${slug}/admin`}
            onClick={() => setOpen(false)}
            className="flex items-center px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            Admin Settings
          </Link>
          {showRenew && (
            <Link
              href={`/tournaments/new?renew=${tournamentId}`}
              onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              Renew Tournament
            </Link>
          )}
          <div className="border-t border-border my-1" />
          <div className="px-3 py-1.5">
            <DeleteTournamentButton
              tournamentId={tournamentId}
              tournamentName={tournamentName}
              size="sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
