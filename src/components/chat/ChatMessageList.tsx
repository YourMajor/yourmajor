'use client'

import type { ChatMessage } from '@/hooks/useChat'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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
    light: { bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-800/50', text: 'text-red-800 dark:text-red-200', icon: '⚔️' },
    dark: { bg: 'bg-red-900/30', border: 'border-red-700/40', text: 'text-red-100' },
  },
  powerup: {
    light: { bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800/50', text: 'text-purple-800 dark:text-purple-200', icon: '⚡' },
    dark: { bg: 'bg-purple-900/30', border: 'border-purple-700/40', text: 'text-purple-100' },
  },
  announcement: {
    light: { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800/50', text: 'text-amber-900 dark:text-amber-200', icon: '📢' },
    dark: { bg: 'bg-amber-900/20', border: 'border-amber-600/30', text: 'text-amber-100' },
  },
}

interface Props {
  messages: ChatMessage[]
  /** 'light' for standard bg, 'dark' for dark-themed chat (live scoring) */
  variant?: 'light' | 'dark'
}

export function ChatMessageList({ messages, variant = 'light' }: Props) {
  const isDark = variant === 'dark'

  if (messages.length === 0) {
    return (
      <p className={`text-center text-sm py-8 ${isDark ? 'text-white/40' : 'text-muted-foreground'}`}>
        No messages yet. Say hello!
      </p>
    )
  }

  return (
    <>
      {messages.map((m) => {
        const initials = (m.user.name ?? '?').charAt(0).toUpperCase()
        const time = new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

        if (m.isSystem) {
          const category = classifySystemMessage(m.content)
          const styles = SYSTEM_STYLES[category][isDark ? 'dark' : 'light']

          return (
            <div key={m.id} className={`flex items-start gap-2 py-2 px-3 rounded-md border ${styles.bg} ${styles.border}`}>
              <p className={`text-xs font-semibold flex-1 ${styles.text} whitespace-pre-line`}>{m.content}</p>
              <span className={`text-[10px] shrink-0 mt-0.5 ${isDark ? 'text-white/50' : 'text-gray-500 dark:text-gray-400'}`}>{time}</span>
            </div>
          )
        }

        return (
          <div key={m.id} className="flex items-start gap-3">
            {isDark ? (
              <div className="shrink-0 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center overflow-hidden">
                {m.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.user.image} alt="" className="w-full h-full object-cover" />
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
              </div>
              <p className={`text-sm mt-0.5 break-words ${isDark ? 'text-white/80' : ''}`}>{m.content}</p>
            </div>
          </div>
        )
      })}
    </>
  )
}
