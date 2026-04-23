'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Trash2, ShieldOff } from 'lucide-react'
import type { ChatMessage } from '@/hooks/useChat'

interface BanEntry {
  id: string
  userId: string
  userName: string | null
  userImage: string | null
  reason: string | null
  expiresAt: string | null
  createdAt: string
}

interface Props {
  tournamentId: string
  initialBans: BanEntry[]
  initialMessages: ChatMessage[]
}

export function ChatModerationPanel({ tournamentId, initialBans, initialMessages }: Props) {
  const [bans, setBans] = useState(initialBans)
  const [messages, setMessages] = useState(initialMessages)

  async function handleUnban(userId: string) {
    const res = await fetch(`/api/tournaments/${tournamentId}/chat-bans`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setBans((prev) => prev.filter((b) => b.userId !== userId))
    }
  }

  async function handleDeleteMessage(messageId: string) {
    const res = await fetch(`/api/tournaments/${tournamentId}/messages/${messageId}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    }
  }

  return (
    <div className="space-y-8">
      {/* Banned Users */}
      <section className="space-y-3">
        <h2 className="text-lg font-heading font-semibold">Banned Users</h2>
        {bans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No active bans</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {bans.map((ban) => (
              <div key={ban.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={ban.userImage ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {(ban.userName ?? '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ban.userName ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">
                    {ban.reason ?? 'No reason given'}
                    {ban.expiresAt && (
                      <> &middot; Expires {new Date(ban.expiresAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnban(ban.userId)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
                >
                  <ShieldOff className="w-3.5 h-3.5" />
                  Unban
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Messages */}
      <section className="space-y-3">
        <h2 className="text-lg font-heading font-semibold">Recent Messages</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No messages</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden max-h-[500px] overflow-y-auto">
            {messages.map((m) => {
              const initials = (m.user.name ?? '?').charAt(0).toUpperCase()
              const time = new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

              return (
                <div key={m.id} className="group flex items-start gap-3 px-4 py-2.5">
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarImage src={m.user.image ?? undefined} />
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold">{m.user.name ?? 'Player'}</span>
                      <span className="text-[10px] text-muted-foreground">{time}</span>
                    </div>
                    <p className="text-xs mt-0.5 break-words text-muted-foreground">{m.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(m.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                    title="Delete message"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
