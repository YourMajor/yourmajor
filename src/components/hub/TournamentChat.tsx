'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { ChatMessageList } from '@/components/chat/ChatMessageList'

interface Props {
  tournamentId: string
  currentUserId: string | null
  isRegistered: boolean
  isAdmin?: boolean
  initialMessages: ChatMessage[]
  slug: string
}

export function TournamentChat({ tournamentId, currentUserId, isRegistered, isAdmin, initialMessages, slug }: Props) {
  const { messages, loaded, sending, input, setInput, sendMessage, handleKeyDown, bottomRef, isBanned, banExpiresAt, banReason, deleteMessage, banUser } = useChat({ tournamentId, channelPrefix: 'hub-chat' })

  // Seed with server-provided initial messages
  if (messages.length === 0 && initialMessages.length > 0 && !loaded) {
    // This is handled via useEffect in the hook — initial messages are fetched eagerly
  }

  if (!currentUserId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-3">Sign in to join the conversation.</p>
        <Link href="/auth/login" className="text-sm underline">Sign in</Link>
      </div>
    )
  }

  if (!isRegistered) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-3">Register for this tournament to join the chat.</p>
        <Link href={`/${slug}/register`} className="text-sm underline">Register</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[480px] border border-border rounded-md overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <ChatMessageList
          messages={messages}
          variant="light"
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onDeleteMessage={isAdmin ? deleteMessage : undefined}
          onBanUser={isAdmin ? banUser : undefined}
        />
        <div ref={bottomRef} />
      </div>

      {isBanned ? (
        <div className="border-t border-border p-3 text-center">
          <p className="text-xs text-red-500 font-medium">
            {banReason ?? 'You are restricted from chatting'}
            {banExpiresAt && (
              <span className="block text-muted-foreground mt-0.5">
                Until {new Date(banExpiresAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="border-t border-border p-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Say something..."
            rows={1}
            className="resize-none flex-1 min-h-0"
            onKeyDown={handleKeyDown}
          />
          <Button onClick={() => sendMessage()} disabled={sending || !input.trim()} size="sm" className="self-end">
            Send
          </Button>
        </div>
      )}
    </div>
  )
}
