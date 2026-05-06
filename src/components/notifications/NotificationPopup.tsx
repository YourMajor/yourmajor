'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Swords, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AttackPayload = {
  attackerName: string
  powerupName: string
  powerupDescription: string
  holeNumber: number
  powerupSlug?: string
}

type DraftTurnPayload = {
  pickNumber: number
  message?: string
}

type DisplayNotification =
  | { id: string; type: 'ATTACK_RECEIVED'; payload: AttackPayload }
  | { id: string; type: 'DRAFT_YOUR_TURN'; payload: DraftTurnPayload }

interface RawNotification {
  id: string
  type: string
  payload: unknown
}

interface NotificationPopupProps {
  tournamentId: string
  tournamentPlayerId: string
  slug: string
}

export function NotificationPopup({ tournamentId, tournamentPlayerId, slug }: NotificationPopupProps) {
  const [notification, setNotification] = useState<DisplayNotification | null>(null)
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const isOnDraftPage = !!pathname && pathname.startsWith(`/${slug}/draft`)

  const markRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      await fetch(`/api/tournaments/${tournamentId}/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).catch(() => {})
    },
    [tournamentId],
  )

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/notifications`)
      if (!res.ok) return
      const data = (await res.json()) as RawNotification[]

      // Silently dismiss draft-turn notifications while the user is on the draft
      // page — they can already see whose turn it is, no need to interrupt.
      if (isOnDraftPage) {
        const draftIds = data.filter((n) => n.type === 'DRAFT_YOUR_TURN').map((n) => n.id)
        if (draftIds.length > 0) {
          void markRead(draftIds)
        }
      }

      const showable = data.find(
        (n) =>
          n.type === 'ATTACK_RECEIVED' || (n.type === 'DRAFT_YOUR_TURN' && !isOnDraftPage),
      )
      if (showable) {
        setNotification(showable as DisplayNotification)
        setVisible(true)
      }
    } catch {
      // ignore
    }
  }, [tournamentId, isOnDraftPage, markRead])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-${tournamentPlayerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Notification',
          filter: `tournamentPlayerId=eq.${tournamentPlayerId}`,
        },
        () => {
          fetchNotifications()
        },
      )
      .subscribe()

    queueMicrotask(() => {
      void fetchNotifications()
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentPlayerId, fetchNotifications])

  const dismiss = async () => {
    setVisible(false)
    if (notification) {
      void markRead([notification.id])
    }
    setTimeout(() => setNotification(null), 300)
  }

  if (!notification || !visible) return null

  if (notification.type === 'ATTACK_RECEIVED') {
    const payload = notification.payload
    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={dismiss} />

        <div className="relative z-10 w-full max-w-sm mx-4 mb-8 sm:mb-0 rounded-2xl border border-red-500/40 bg-gradient-to-b from-red-950 to-zinc-950 p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 p-1 text-white/40 hover:text-white rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
              <Swords className="w-7 h-7 text-red-400" />
            </div>

            <div>
              <p className="text-xs text-red-400 uppercase tracking-wider font-bold mb-1">
                You&apos;ve been attacked!
              </p>
              <h3 className="text-xl font-heading font-bold text-white">
                {payload.powerupName}
              </h3>
            </div>

            <p className="text-sm text-white/70 leading-relaxed">
              <span className="font-semibold text-red-300">{payload.attackerName}</span>{' '}
              used this on <span className="font-semibold text-white">Hole {payload.holeNumber}</span>
            </p>

            <p className="text-xs text-white/50 italic">
              {payload.powerupDescription}
            </p>

            <Button
              onClick={dismiss}
              className="w-full bg-red-600 hover:bg-red-700 text-white mt-2"
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // DRAFT_YOUR_TURN
  const payload = notification.payload
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={dismiss} />

      <div className="relative z-10 w-full max-w-sm mx-4 mb-8 sm:mb-0 rounded-2xl border border-amber-400/40 bg-gradient-to-b from-amber-950 to-zinc-950 p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 text-white/40 hover:text-white rounded-full hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-400/20 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-amber-300" />
          </div>

          <div>
            <p className="text-xs text-amber-300 uppercase tracking-wider font-bold mb-1">
              Powerup Draft
            </p>
            <h3 className="text-xl font-heading font-bold text-white">
              You&apos;re on the clock
            </h3>
          </div>

          <p className="text-sm text-white/70 leading-relaxed">
            Pick #{payload.pickNumber} — it&apos;s your turn to choose a powerup.
          </p>

          <Link href={`/${slug}/draft`} onClick={dismiss} className="w-full">
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 mt-2">
              Go to Draft
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
