'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { MessageCircle, X, Send, ChevronDown } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { ChatMessageList } from '@/components/chat/ChatMessageList'

interface PersistentChatProps {
  tournamentId: string
  currentUserId: string | null
  currentUserName: string | null
  isRegistered: boolean
  label?: string
}

export function PersistentChat({ tournamentId, currentUserId, currentUserName, isRegistered, label }: PersistentChatProps) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasAttack, setHasAttack] = useState(false)
  const lastSeenCount = useRef(0)

  // Swipe-to-dismiss state
  const dragStartY = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const { messages, loaded, sending, input, setInput, sendMessage, handleKeyDown, fetchMessages, scrollToBottom, bottomRef } = useChat({ tournamentId, channelPrefix: 'persistent-chat', eager: false })

  // Fetch on first open
  useEffect(() => {
    if (open && !loaded) {
      fetchMessages()
    }
  }, [open, loaded, fetchMessages])

  // Track unread when messages change while closed
  useEffect(() => {
    if (!open && messages.length > lastSeenCount.current) {
      const newCount = messages.length - lastSeenCount.current
      setUnreadCount(newCount)
      const newMsgs = messages.slice(lastSeenCount.current)
      const hasNewAttack = newMsgs.some(
        (m) => m.isSystem && m.content.includes('ATTACKED') && currentUserName && m.content.includes(currentUserName)
      )
      if (hasNewAttack) setHasAttack(true)
    }
  }, [messages, open, currentUserName])

  // Mark as read when opened
  useEffect(() => {
    if (open && messages.length > 0) {
      lastSeenCount.current = messages.length
      queueMicrotask(() => {
        setUnreadCount(0)
        setHasAttack(false)
      })
      scrollToBottom()
    }
  }, [open, messages.length, scrollToBottom])

  // Subscribe to attack notifications
  useEffect(() => {
    if (!currentUserId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`persistent-notif-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Notification' },
        (payload: { new?: { type?: string } }) => {
          if (payload.new?.type === 'ATTACK_RECEIVED') {
            setHasAttack(true)
            if (!open) setUnreadCount((c) => c + 1)
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId, currentUserId, open])

  // Swipe-down handlers
  const onHeaderTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
    setIsDragging(true)
  }
  const onHeaderTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const dy = e.touches[0].clientY - dragStartY.current
    if (dy > 0) setDragOffset(dy)
  }
  const onHeaderTouchEnd = () => {
    if (dragOffset > 80) setOpen(false)
    setDragOffset(0)
    setIsDragging(false)
    dragStartY.current = null
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-24 md:bottom-5 right-5 z-[80] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: 'var(--color-primary, #006747)' }}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!open && unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1 ${
            hasAttack ? 'bg-red-500 animate-pulse' : 'bg-red-500'
          }`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed inset-0 sm:inset-auto sm:bottom-20 sm:right-5 z-[80] sm:w-[420px] sm:max-w-[calc(100vw-40px)] sm:h-[540px] sm:max-h-[calc(100vh-120px)] sm:rounded-2xl shadow-2xl border-0 sm:border sm:border-border bg-background flex flex-col overflow-hidden"
          style={{
            transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            opacity: dragOffset > 0 ? Math.max(0.4, 1 - dragOffset / 300) : 1,
          }}
        >
          {/* Header */}
          <div
            className="shrink-0 px-4 sm:px-5 py-3.5 sm:py-3 flex items-center justify-between touch-pan-y"
            style={{ backgroundColor: 'var(--color-primary, #006747)' }}
            onTouchStart={onHeaderTouchStart}
            onTouchMove={onHeaderTouchMove}
            onTouchEnd={onHeaderTouchEnd}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-sm font-heading font-bold text-white">{label ?? 'Tournament Chat'}</h3>
              <ChevronDown className="w-4 h-4 text-white/40 sm:hidden" />
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10">
              <X className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-4 py-4 sm:py-3 space-y-3 sm:space-y-2.5">
            <ChatMessageList messages={messages} variant="light" />
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {isRegistered && (
            <div
              className="shrink-0 border-t border-border px-4 sm:px-3 py-3 sm:py-2 flex gap-2 items-end"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Say something..."
                rows={1}
                className="flex-1 resize-none rounded-lg border border-border bg-muted/30 px-3 sm:px-2.5 py-2.5 sm:py-1.5 text-sm sm:text-xs outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/20"
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={sending || !input.trim()}
                className="shrink-0 p-2.5 sm:p-2 rounded-lg disabled:opacity-30 transition-colors"
                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                aria-label="Send"
              >
                <Send className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
