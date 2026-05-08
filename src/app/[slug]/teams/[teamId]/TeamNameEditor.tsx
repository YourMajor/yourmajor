'use client'

import { useState, useTransition } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { updateTeamName } from '../../admin/teams/actions'

interface Props {
  slug: string
  teamId: string
  initialName: string
  canEdit: boolean
}

export function TeamNameEditor({ slug, teamId, initialName, canEdit }: Props) {
  const [name, setName] = useState(initialName)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!canEdit) {
    return <h1 className="text-2xl font-heading font-bold">{name}</h1>
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-heading font-bold">{name}</h1>
        <button
          type="button"
          onClick={() => {
            setDraft(name)
            setError(null)
            setEditing(true)
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Rename team"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const next = draft.trim()
        if (!next) {
          setError('Team name is required')
          return
        }
        if (next === name) {
          setEditing(false)
          return
        }
        startTransition(async () => {
          const res = await updateTeamName({ slug, teamId, name: next })
          if ('error' in res) {
            setError(res.error)
            return
          }
          setName(next)
          setEditing(false)
          setError(null)
        })
      }}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={80}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditing(false)
              setError(null)
            }
          }}
          className="rounded-md border border-border bg-background px-2 py-1 text-2xl font-heading font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          aria-label="Team name"
        />
        <button
          type="submit"
          disabled={pending}
          className="text-[var(--color-primary)] hover:opacity-80 disabled:opacity-50"
          aria-label="Save team name"
        >
          <Check className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setError(null)
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cancel rename"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  )
}
