'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface ChatMessage {
  id: string
  content: string
  isSystem?: boolean
  createdAt: Date
  userId: string
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
  const [isBanned, setIsBanned] = useState(false)
  const [banExpiresAt, setBanExpiresAt] = useState<Date | null>(null)
  const [banReason, setBanReason] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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
        setError(null)
        return data as ChatMessage[]
      }
      setError('Failed to load chat.')
    } catch {
      setError('Failed to load chat.')
    }
    return null
  }, [tournamentId])

  const fetchBanStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/chat-bans/me`)
      if (res.ok) {
        const data = await res.json()
        setIsBanned(data.banned)
        setBanExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null)
        setBanReason(data.reason ?? null)
      }
    } catch {
      // Non-critical — ban status failing silently is acceptable
    }
  }, [tournamentId])

  // Eager fetch on mount
  useEffect(() => {
    if (eager && !loaded) {
      fetchMessages()
      fetchBanStatus()
    }
  }, [eager, loaded, fetchMessages, fetchBanStatus])

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-clear temporary bans when they expire
  useEffect(() => {
    if (!isBanned || !banExpiresAt) return
    const ms = banExpiresAt.getTime() - Date.now()
    if (ms <= 0) {
      setIsBanned(false)
      setBanExpiresAt(null)
      setBanReason(null)
      return
    }
    const timer = setTimeout(() => {
      setIsBanned(false)
      setBanExpiresAt(null)
      setBanReason(null)
    }, ms)
    return () => clearTimeout(timer)
  }, [isBanned, banExpiresAt])

  // Supabase real-time subscription (INSERT + UPDATE for soft-delete).
  // Bursts of events (e.g. a flurry of system messages or a moderator
  // soft-deleting many at once) are coalesced into a single refetch so we
  // don't pull the full message history repeatedly per WebSocket event.
  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { fetchMessages() }, 300)
    }
    const channel = supabase
      .channel(`${channelPrefix}-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'TournamentMessage', filter: `tournamentId=eq.${tournamentId}` },
        scheduleRefetch,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'TournamentMessage', filter: `tournamentId=eq.${tournamentId}` },
        scheduleRefetch,
      )
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [tournamentId, channelPrefix, fetchMessages])

  const sendMessage = useCallback(async (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || sending || isBanned) return false
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
      // Handle ban / rate-limit responses
      if (res.status === 403 || res.status === 429) {
        const data = await res.json()
        setIsBanned(true)
        setBanExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null)
        setBanReason(data.error ?? null)
      }
    } finally {
      setSending(false)
    }
    return false
  }, [input, sending, isBanned, tournamentId])

  const deleteMessage = useCallback(async (messageId: string) => {
    const res = await fetch(`/api/tournaments/${tournamentId}/messages/${messageId}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    }
    return res.ok
  }, [tournamentId])

  const banUser = useCallback(async (userId: string, reason?: string) => {
    const res = await fetch(`/api/tournaments/${tournamentId}/chat-bans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason }),
    })
    return res.ok
  }, [tournamentId])

  const unbanUser = useCallback(async (userId: string) => {
    const res = await fetch(`/api/tournaments/${tournamentId}/chat-bans`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    return res.ok
  }, [tournamentId])

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
    fetchBanStatus,
    scrollToBottom,
    bottomRef,
    isBanned,
    banExpiresAt,
    banReason,
    deleteMessage,
    banUser,
    unbanUser,
    error,
  }
}
