import { supabaseAdmin } from './supabase'

const BROADCAST_TIMEOUT_MS = 1500

/**
 * Notify draft-page clients that a pick happened so they refetch state.
 * Bypasses RLS (broadcasts are channel-scoped, not row-filtered) so this
 * works even when the realtime postgres_changes path is broken for a user.
 *
 * Fire-and-forget: never throws, never blocks longer than the timeout.
 */
export async function broadcastDraftPick(draftId: string): Promise<void> {
  try {
    await new Promise<void>((resolve) => {
      const channel = supabaseAdmin.channel(`draft-${draftId}`)
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
            await channel.send({ type: 'broadcast', event: 'pick', payload: {} })
          } catch (err) {
            console.warn('[draft-broadcast] send failed', err)
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
    console.warn('[draft-broadcast] unexpected error', err)
  }
}
