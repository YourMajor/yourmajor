'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { DeleteTournamentButton } from '@/app/[slug]/admin/setup/DeleteTournamentButton'

interface Props {
  slug: string
  tournamentId: string
  tournamentName: string
  showAdminActions?: boolean
  showRenew?: boolean
  showUnwatch?: boolean
}

export function TournamentCardMenu({
  slug,
  tournamentId,
  tournamentName,
  showAdminActions = true,
  showRenew,
  showUnwatch,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unwatching, setUnwatching] = useState(false)
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

  async function handleUnwatch() {
    setUnwatching(true)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/watch`, { method: 'DELETE' })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      }
    } finally {
      setUnwatching(false)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label="More options"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-20 w-44 rounded-lg border border-border bg-background text-foreground shadow-lg py-1">
          {showAdminActions && (
            <>
              <Link
                href={`/${slug}/admin`}
                onClick={() => setOpen(false)}
                className="flex items-center px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                Admin Settings
              </Link>
              {showRenew && (
                <Link
                  href={`/tournaments/new?renew=${tournamentId}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
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
            </>
          )}
          {showUnwatch && (
            <button
              type="button"
              onClick={handleUnwatch}
              disabled={unwatching}
              className="flex w-full items-center px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {unwatching ? 'Removing…' : 'Stop Watching'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
