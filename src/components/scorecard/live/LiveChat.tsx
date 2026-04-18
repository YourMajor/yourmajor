'use client'

import { useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { ChatMessageList } from '@/components/chat/ChatMessageList'

interface LiveChatProps {
  tournamentId: string
  open: boolean
  onClose: () => void
}

export function LiveChat({ tournamentId, open, onClose }: LiveChatProps) {
  const chat = useChat({ tournamentId, channelPrefix: 'live-chat', eager: false })

  // Fetch on first open
  useEffect(() => {
    if (open && !chat.loaded) {
      chat.fetchMessages()
    }
  }, [open, chat.loaded, chat.fetchMessages])

  // Scroll when opened
  useEffect(() => {
    if (open) chat.scrollToBottom()
  }, [open, chat.messages, chat.scrollToBottom])

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col transition-transform duration-300 ease-out ${
        open ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ backgroundColor: 'var(--color-primary, oklch(0.40 0.11 160))' }}
    >
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/20">
        <h3 className="text-base font-heading font-bold text-white">Chat</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors touch-manipulation"
          aria-label="Close chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <ChatMessageList messages={chat.messages} variant="dark" />
        <div ref={chat.bottomRef} />
      </div>

      <div className="shrink-0 px-4 py-3 bg-black/20">
        <div className="flex gap-2 items-end">
          <textarea
            value={chat.input}
            onChange={(e) => chat.setInput(e.target.value)}
            placeholder="Say something..."
            rows={1}
            className="flex-1 resize-none rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
            onKeyDown={chat.handleKeyDown}
          />
          <button
            type="button"
            onClick={() => chat.sendMessage()}
            disabled={chat.sending || !chat.input.trim()}
            className="shrink-0 p-2.5 rounded-lg disabled:opacity-30 active:scale-90 transition-all touch-manipulation"
            style={{
              backgroundColor: 'var(--color-accent, oklch(0.72 0.11 78))',
              color: 'var(--color-primary, oklch(0.40 0.11 160))',
            }}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
