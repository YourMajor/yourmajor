'use client'

import { useState, useTransition } from 'react'
import { Crown, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  setTeamCaptain,
  createTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
} from './actions'

interface TeamMember {
  memberRowId: string
  tournamentPlayerId: string
  name: string
  avatarUrl: string | null
  isCaptain: boolean
}

interface Team {
  id: string
  name: string
  color: string | null
  members: TeamMember[]
}

interface UnassignedPlayer {
  tournamentPlayerId: string
  name: string
  avatarUrl: string | null
}

interface Props {
  slug: string
  teams: Team[]
  unassignedPlayers: UnassignedPlayer[]
  recommendedTeamSize: number | null
}

const DEFAULT_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

export function TeamsAdmin({ slug, teams, unassignedPlayers, recommendedTeamSize }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState<string>(DEFAULT_COLORS[teams.length % DEFAULT_COLORS.length])
  const [openMemberPicker, setOpenMemberPicker] = useState<string | null>(null)

  function run(action: () => Promise<{ ok: true } | { ok: true; teamId: string } | { error: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if ('error' in res) setError(res.error)
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    run(async () => {
      const res = await createTeam({ slug, name: newTeamName, color: newTeamColor })
      if ('ok' in res) {
        setNewTeamName('')
        setShowCreate(false)
      }
      return res
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Create team ─────────────────────────────────────────────── */}
      {showCreate ? (
        <form onSubmit={handleCreate} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">New Team</h2>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setError(null) }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Team name"
            maxLength={80}
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Color</span>
            <div className="flex gap-1.5">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTeamColor(c)}
                  aria-label={`Select color ${c}`}
                  aria-pressed={newTeamColor === c}
                  className={`h-6 w-6 rounded-full ring-2 transition-all ${
                    newTeamColor === c ? 'ring-foreground scale-110' : 'ring-transparent hover:ring-border'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || !newTeamName.trim()}
              className="rounded-md bg-[var(--color-primary)] text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              Create Team
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setError(null) }}
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm font-semibold hover:bg-muted transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Team
        </button>
      )}

      {/* ── Teams list ──────────────────────────────────────────────── */}
      {teams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No teams yet. Click <span className="font-semibold">New Team</span> above to add one.
        </div>
      ) : (
        teams.map((team) => {
          const atRecommendedSize =
            recommendedTeamSize !== null && team.members.length >= recommendedTeamSize
          return (
            <section key={team.id} className="rounded-lg border border-border bg-card p-4">
              <header className="flex items-center gap-3 mb-3">
                <span
                  className="inline-block h-4 w-4 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: team.color ?? 'var(--color-primary, oklch(0.40 0.11 160))' }}
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold">{team.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {team.members.length} member{team.members.length === 1 ? '' : 's'}
                  {recommendedTeamSize !== null && ` of ${recommendedTeamSize}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete team "${team.name}"? Members will be unassigned.`)) {
                      run(() => deleteTeam({ slug, teamId: team.id }))
                    }
                  }}
                  disabled={pending}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-red-700 hover:text-red-900 disabled:opacity-50"
                  aria-label={`Delete team ${team.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </header>

              {team.members.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No members yet.</p>
              ) : (
                <fieldset className="space-y-1.5" disabled={pending}>
                  <legend className="sr-only">Captain selector for {team.name}</legend>
                  {team.members.map((m) => (
                    <div
                      key={m.memberRowId}
                      className={`flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors ${
                        m.isCaptain ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`captain-${team.id}`}
                        value={m.tournamentPlayerId}
                        checked={m.isCaptain}
                        onChange={() => run(() => setTeamCaptain({
                          slug,
                          teamId: team.id,
                          newCaptainPlayerId: m.tournamentPlayerId,
                        }))}
                        aria-label={`Set ${m.name} as captain`}
                        className="h-4 w-4"
                      />
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={m.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                          {m.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-sm font-medium">{m.name}</span>
                      {m.isCaptain && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                          <Crown className="w-3 h-3" />
                          Captain
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => run(() => removeTeamMember({ slug, memberRowId: m.memberRowId }))}
                        disabled={pending}
                        className="text-muted-foreground hover:text-red-700 disabled:opacity-50"
                        aria-label={`Remove ${m.name} from team`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </fieldset>
              )}

              {/* ── Add member ───────────────────────────────────────── */}
              {openMemberPicker === team.id ? (
                <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Add member
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenMemberPicker(null)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Close member picker"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {unassignedPlayers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      All registered players are already assigned to teams.
                    </p>
                  ) : (
                    <ul className="space-y-1 max-h-60 overflow-y-auto">
                      {unassignedPlayers.map((p) => (
                        <li key={p.tournamentPlayerId}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              run(async () => {
                                const res = await addTeamMember({
                                  slug,
                                  teamId: team.id,
                                  tournamentPlayerId: p.tournamentPlayerId,
                                })
                                if ('ok' in res) setOpenMemberPicker(null)
                                return res
                              })
                            }}
                            className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted text-left transition-colors disabled:opacity-50"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={p.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                                {p.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{p.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenMemberPicker(team.id)}
                  disabled={pending || atRecommendedSize}
                  title={atRecommendedSize ? 'Team is at recommended size' : undefined}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add member
                </button>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
