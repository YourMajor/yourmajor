'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { ChatMessage } from '@/hooks/useChat'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Trash2, Ban } from 'lucide-react'

type SystemCategory = 'attack' | 'powerup' | 'announcement'

function classifySystemMessage(content: string): SystemCategory {
  if (content.includes('ATTACKED')) return 'attack'
  if (content.includes('used ') || content.includes('activated ') || content.includes('⚡')) return 'powerup'
  return 'announcement'
}

const SYSTEM_STYLES: Record<SystemCategory, {
  light: { bg: string; border: string; text: string; icon: string }
  dark: { bg: string; border: string; text: string }
}> = {
  attack: {
    light: { bg: 'bg-powerup-attack/10', border: 'border-powerup-attack/25', text: 'text-powerup-attack-deep', icon: '⚔️' },
    dark: { bg: 'bg-powerup-attack/25', border: 'border-powerup-attack/40', text: 'text-powerup-stock' },
  },
  powerup: {
    light: { bg: 'bg-powerup-active/10', border: 'border-powerup-active/25', text: 'text-powerup-active', icon: '⚡' },
    dark: { bg: 'bg-powerup-active/25', border: 'border-powerup-active/40', text: 'text-powerup-stock' },
  },
  announcement: {
    light: { bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-gold-ink', icon: '📢' },
    dark: { bg: 'bg-warning/15', border: 'border-warning/30', text: 'text-warning' },
  },
}

interface Props {
  messages: ChatMessage[]
  /** 'light' for standard bg, 'dark' for dark-themed chat (live scoring) */
  variant?: 'light' | 'dark'
  isAdmin?: boolean
  currentUserId?: string | null
  onDeleteMessage?: (id: string) => void
  onBanUser?: (userId: string, userName: string) => void
}

export function ChatMessageList({ messages, variant = 'light', isAdmin, currentUserId, onDeleteMessage, onBanUser }: Props) {
  const isDark = variant === 'dark'
  const [confirmBan, setConfirmBan] = useState<{ userId: string; name: string } | null>(null)

  if (messages.length === 0) {
    return (
      <p className={`text-center text-sm py-8 ${isDark ? 'text-white/40' : 'text-muted-foreground'}`}>
        No messages yet. Say hello!
      </p>
    )
  }

  return (
    <>
      {/* Ban confirmation dialog */}
      {confirmBan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background border border-border rounded-lg p-5 shadow-xl max-w-sm mx-4 space-y-3">
            <p className="text-sm font-semibold">Ban {confirmBan.name} from chat?</p>
            <p className="text-xs text-muted-foreground">This user will not be able to send messages until unbanned.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBan(null)}
                className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onBanUser?.(confirmBan.userId, confirmBan.name)
                  setConfirmBan(null)
                }}
                className="px-3 py-1.5 text-xs rounded-md bg-destructive text-white hover:bg-destructive/90"
              >
                Ban User
              </button>
            </div>
          </div>
        </div>
      )}

      {messages.map((m) => {
        const initials = (m.user.name ?? '?').charAt(0).toUpperCase()
        const time = new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        const isOwnMessage = currentUserId && m.userId === currentUserId
        const showAdminControls = isAdmin && !m.isSystem && !isOwnMessage

        if (m.isSystem) {
          const category = classifySystemMessage(m.content)
          const styles = SYSTEM_STYLES[category][isDark ? 'dark' : 'light']

          return (
            <div key={m.id} className={`group flex items-start gap-2 py-2 px-3 rounded-md border ${styles.bg} ${styles.border}`}>
              <p className={`text-xs font-semibold flex-1 ${styles.text} whitespace-pre-line`}>{m.content}</p>
              <span className={`text-[11px] shrink-0 mt-0.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{time}</span>
              {isAdmin && onDeleteMessage && (
                <button
                  type="button"
                  onClick={() => onDeleteMessage(m.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-black/10"
                  title="Delete message"
                  aria-label="Delete message"
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          )
        }

        return (
          <div key={m.id} className="group flex items-start gap-3">
            {isDark ? (
              <div className="shrink-0 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center overflow-hidden">
                {m.user.image ? (
                  <Image src={m.user.image} alt="" fill sizes="32px" className="object-cover" />
                ) : (
                  <span className="text-xs font-bold text-white/70">{initials}</span>
                )}
              </div>
            ) : (
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={m.user.image ?? undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className={`text-sm font-semibold ${isDark ? 'text-white' : ''}`}>{m.user.name ?? 'Player'}</span>
                <span className={`text-xs ${isDark ? 'text-white/40' : 'text-muted-foreground'}`}>{time}</span>
                {showAdminControls && (
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-auto">
                    {onDeleteMessage && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(m.id)}
                        className="p-0.5 rounded hover:bg-black/10"
                        title="Delete message"
                        aria-label="Delete message"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                      </button>
                    )}
                    {onBanUser && (
                      <button
                        type="button"
                        onClick={() => setConfirmBan({ userId: m.userId, name: m.user.name ?? 'this user' })}
                        className="p-0.5 rounded hover:bg-black/10"
                        title="Ban user from chat"
                        aria-label={`Ban ${m.user.name ?? 'this user'} from chat`}
                      >
                        <Ban className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                      </button>
                    )}
                  </span>
                )}
              </div>
              <p className={`text-sm mt-0.5 break-words ${isDark ? 'text-white/80' : ''}`}>{m.content}</p>
            </div>
          </div>
        )
      })}
    </>
  )
}
