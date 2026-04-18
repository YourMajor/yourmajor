'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Swords, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AttackNotification {
  id: string
  type: string
  payload: {
    attackerName: string
    powerupName: string
    powerupDescription: string
    holeNumber: number
    powerupSlug?: string
  }
}

interface NotificationPopupProps {
  tournamentId: string
  tournamentPlayerId: string
}

export function NotificationPopup({ tournamentId, tournamentPlayerId }: NotificationPopupProps) {
  const [notification, setNotification] = useState<AttackNotification | null>(null)
  const [visible, setVisible] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/notifications`)
      if (!res.ok) return
      const data = await res.json() as AttackNotification[]
      // Show the first unread attack notification
      const attack = data.find((n) => n.type === 'ATTACK_RECEIVED')
      if (attack) {
        setNotification(attack)
        setVisible(true)
      }
    } catch {
      // ignore
    }
  }, [tournamentId])

  // Subscribe to new notifications
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

    // Initial check — deferred to avoid synchronous setState in effect
    queueMicrotask(() => { void fetchNotifications() })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentPlayerId, fetchNotifications])

  const dismiss = async () => {
    setVisible(false)
    if (notification) {
      // Mark as read
      await fetch(`/api/tournaments/${tournamentId}/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [notification.id] }),
      }).catch(() => {})
    }
    setTimeout(() => setNotification(null), 300)
  }

  if (!notification || !visible) return null

  const payload = notification.payload

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={dismiss} />

      {/* Card */}
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
