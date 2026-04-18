'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface ChatMessage {
  id: string
  content: string
  isSystem?: boolean
  createdAt: Date
  user: { name: string | null; image: string | null }
}

interface UseChatOptions {
  tournamentId: string
  /** Channel name prefix to avoid collisions when multiple chat UIs exist */
  channelPrefix?: string
  /** If true, messages are fetched immediately; if false, wait until fetchMessages is called */
  eager?: boolean
}

export function useChat({ tournamentId, channelPrefix = 'chat', eager = true }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/messages`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
        setLoaded(true)
        return data as ChatMessage[]
      }
    } catch {
      // Non-critical
    }
    return null
  }, [tournamentId])

  // Eager fetch on mount
  useEffect(() => {
    if (eager && !loaded) {
      fetchMessages()
    }
  }, [eager, loaded, fetchMessages])

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Supabase real-time subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`${channelPrefix}-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'TournamentMessage', filter: `tournamentId=eq.${tournamentId}` },
        () => fetchMessages(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId, channelPrefix, fetchMessages])

  const sendMessage = useCallback(async (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || sending) return false
    setSending(true)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (res.ok) {
        const newMsg = await res.json()
        setMessages((prev) =>
          prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg],
        )
        setInput('')
        return true
      }
    } finally {
      setSending(false)
    }
    return false
  }, [input, sending, tournamentId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  return {
    messages,
    loaded,
    sending,
    input,
    setInput,
    sendMessage,
    handleKeyDown,
    fetchMessages,
    scrollToBottom,
    bottomRef,
  }
}
