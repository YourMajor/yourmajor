'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Inline tournament-code lookup for the hero. Expands in place of the
 * "Join with a code" CTA; Escape collapses back and the caller restores focus.
 *
 * Note the lookup-failure message is deliberately NOT red: on marketing
 * surfaces red means under par, never error (DESIGN.md).
 */
export function HeroCodeSearch({ onDismiss }: { onDismiss: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/tournaments/find?code=${encodeURIComponent(trimmed)}`)
      if (!res.ok) {
        setError('No tournament found with that code.')
        return
      }
      const data = await res.json()
      router.push(`/${data.slug}`)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="flex gap-2"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onDismiss()
        }}
      >
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setError(null)
          }}
          placeholder="Tournament code"
          aria-label="Tournament code"
          required
          className="h-12 w-44 px-4 text-base font-semibold uppercase tracking-[0.08em] outline-none transition-colors"
          style={{
            background: 'oklch(0.95 0.012 85 / 0.08)',
            border: '1px solid var(--mk-rule-light)',
            borderRadius: 'var(--mk-radius-md)',
            color: 'var(--mk-text)',
            caretColor: 'var(--mk-gold)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--mk-gold)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--mk-rule-light)'
          }}
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="mk-btn mk-btn-primary disabled:opacity-60"
        >
          {loading ? '…' : 'Go'}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm" style={{ color: 'var(--mk-text-subtle)' }} role="status">
          {error}
        </p>
      )}
    </div>
  )
}
