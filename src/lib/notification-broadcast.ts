import { supabaseAdmin } from './supabase'

const BROADCAST_TIMEOUT_MS = 1500

/**
 * Notify a single tournament-player's clients that a new in-app notification
 * exists so the NotificationPopup refetches immediately. Mirrors the draft
 * broadcast pattern: bypasses RLS (broadcasts are channel-scoped, not
 * row-filtered) so this works even though the app uses NextAuth and the
 * supabase browser client never carries a JWT for postgres_changes RLS.
 *
 * Fire-and-forget: never throws, never blocks longer than the timeout.
 */
export async function broadcastNotification(tournamentPlayerId: string): Promise<void> {
  try {
    await new Promise<void>((resolve) => {
      const channel = supabaseAdmin.channel(`notifications-${tournamentPlayerId}`)
      let settled = false

      const finish = () => {
        if (settled) return
        settled = true
        void supabaseAdmin.removeChannel(channel)
        resolve()
      }

      const timer = setTimeout(finish, BROADCAST_TIMEOUT_MS)

      channel.subscribe(async (status) => {
        if (settled) return
        if (status === 'SUBSCRIBED') {
          try {
            await channel.send({ type: 'broadcast', event: 'new', payload: {} })
          } catch (err) {
            console.warn('[notification-broadcast] send failed', err)
          }
          clearTimeout(timer)
          finish()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timer)
          finish()
        }
      })
    })
  } catch (err) {
    console.warn('[notification-broadcast] unexpected error', err)
  }
}
