'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, X, UserPlus, Users, Clock, Flag, Send, ArrowLeft, Pencil, Check, Wand2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import {
  createGroup,
  deleteGroup,
  renameGroup,
  movePlayerToGroup,
  addLatePlayer,
  removePlayer,
  updateGroupTeeTime,
  updateGroupStartingHole,
  notifyAffectedPlayers,
  notifyAllPlayers,
  dismissVacancy,
  dismissAllVacancies,
} from '@/app/[slug]/admin/groups/actions'
import { GroupAutoAssignDialog } from './GroupAutoAssignDialog'

// Special droppable id for the unassigned pool. Group ids are passed verbatim.
const UNASSIGNED_DROPPABLE_ID = '__unassigned__'

// Wraps a player pill so it can be dragged. Passes through children + className/onClick.
function DraggablePill({
  id,
  children,
  className,
  onClick,
}: {
  id: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'manipulation',
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`${className ?? ''} ${isDragging ? 'opacity-30' : ''}`.trim()}
    >
      {children}
    </div>
  )
}

// Wraps a group card or the unassigned card so it can receive drops.
function DroppableArea({
  id,
  children,
  highlight = true,
}: {
  id: string
  children: React.ReactNode
  highlight?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={highlight && isOver ? 'ring-2 ring-[var(--color-primary)] rounded-xl transition-all' : ''}
    >
      {children}
    </div>
  )
}

// Color tier for the handicap badge — lower = greener.
function handicapTier(h: number): { bg: string; text: string } {
  if (h < 5) return { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' }
  if (h < 15) return { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' }
  return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' }
}

// ── Types ────────────────────────────────────────────────────────────────────

type Player = {
  id: string
  name: string
  email: string
  handicap: number
  groupId: string | null
}

type GroupMember = {
  tournamentPlayerId: string
  name: string
  position: number
  notifiedAt: string | null
}

type Group = {
  id: string
  name: string
  teeTime: string | null
  startingHole: number | null
  lastNotifiedTeeTime: string | null
  lastNotifiedStartHole: number | null
  members: GroupMember[]
}

type Vacancy = {
  id: string
  groupName: string
  teeTime: string | null
  startingHole: number | null
  playerName: string
  unregisteredAt: string
}

interface Props {
  tournamentId: string
  tournamentName: string
  slug: string
  isLeague: boolean
  initialPlayers: Player[]
  initialGroups: Group[]
  initialVacancies?: Vacancy[]
}

// ── Component ────────────────────────────────────────────────────────────────

export function GroupBuilder({ tournamentId, tournamentName, slug, isLeague, initialPlayers, initialGroups, initialVacancies = [] }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [vacancies, setVacancies] = useState<Vacancy[]>(initialVacancies)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set())
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [autoAssignOpen, setAutoAssignOpen] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  // Sensors: PointerSensor with `distance: 8` ensures plain clicks (under 8px
  // movement) still fire the underlying onClick handlers — drag only kicks in
  // once the user has actually moved. TouchSensor uses a 200ms long-press to
  // avoid hijacking page scroll on mobile.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const unassigned = players.filter((p) => !p.groupId).sort((a, b) => a.name.localeCompare(b.name))
  const draggedPlayer = activeDragId ? players.find((p) => p.id === activeDragId) ?? null : null

  // ── Tap-to-select interaction (multi-select) ────────────────────────────

  function handlePlayerTap(playerId: string) {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else {
        next.add(playerId)
      }
      return next
    })
  }

  function handleRemoveFromGroup(playerId: string) {
    const player = players.find((p) => p.id === playerId)
    if (!player?.groupId) return

    // Optimistic update
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, groupId: null } : p)))
    setGroups((prev) =>
      prev.map((g) =>
        g.id === player.groupId
          ? { ...g, members: g.members.filter((m) => m.tournamentPlayerId !== playerId) }
          : g,
      ),
    )

    startTransition(async () => {
      try {
        await movePlayerToGroup(tournamentId, playerId, null)
      } catch {
        router.refresh()
      }
    })
  }

  function handleGroupTap(groupId: string | null) {
    if (selectedPlayerIds.size === 0) return

    const movingPlayers = players.filter((p) => selectedPlayerIds.has(p.id) && p.groupId !== groupId)
    if (movingPlayers.length === 0) {
      setSelectedPlayerIds(new Set())
      return
    }

    // Cap at 4 members per group
    if (groupId) {
      const group = groups.find((g) => g.id === groupId)
      if (group) {
        const currentCount = group.members.length
        const spotsLeft = 4 - currentCount
        if (spotsLeft <= 0) {
          setSelectedPlayerIds(new Set())
          return
        }
        if (movingPlayers.length > spotsLeft) {
          movingPlayers.splice(spotsLeft)
        }
      }
    }

    const movingIds = new Set(movingPlayers.map((p) => p.id))

    // Optimistic update
    setPlayers((prev) =>
      prev.map((p) => (movingIds.has(p.id) ? { ...p, groupId } : p)),
    )

    setGroups((prev) => {
      // Remove from old groups
      let updated = prev.map((g) => ({
        ...g,
        members: g.members.filter((m) => !movingIds.has(m.tournamentPlayerId)),
      }))
      // Add to target group
      if (groupId) {
        updated = updated.map((g) => {
          if (g.id !== groupId) return g
          const filteredMembers = g.members.filter((m) => !movingIds.has(m.tournamentPlayerId))
          const newMembers = movingPlayers.map((p, i) => ({
            tournamentPlayerId: p.id,
            name: p.name,
            position: filteredMembers.length + i,
            notifiedAt: null,
          }))
          return { ...g, members: [...g.members, ...newMembers] }
        })
      }
      return updated
    })

    const idsToMove = [...movingIds]
    setSelectedPlayerIds(new Set())

    startTransition(async () => {
      try {
        await Promise.all(idsToMove.map((id) => movePlayerToGroup(tournamentId, id, groupId)))
      } catch {
        router.refresh()
      }
    })
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDragId(null)
    const activeId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    if (!overId) return

    const player = players.find((p) => p.id === activeId)
    if (!player) return

    const targetGroupId = overId === UNASSIGNED_DROPPABLE_ID ? null : overId
    if (player.groupId === targetGroupId) return

    // Cap at 4 per group (server enforces too).
    if (targetGroupId) {
      const target = groups.find((g) => g.id === targetGroupId)
      if (target && target.members.length >= 4) return
    }

    // Optimistic update mirrored from handleGroupTap's single-player path.
    setPlayers((prev) =>
      prev.map((p) => (p.id === activeId ? { ...p, groupId: targetGroupId } : p)),
    )
    setGroups((prev) => {
      let updated = prev.map((g) => ({
        ...g,
        members: g.members.filter((m) => m.tournamentPlayerId !== activeId),
      }))
      if (targetGroupId) {
        updated = updated.map((g) => {
          if (g.id !== targetGroupId) return g
          const filtered = g.members.filter((m) => m.tournamentPlayerId !== activeId)
          return {
            ...g,
            members: [
              ...filtered,
              {
                tournamentPlayerId: player.id,
                name: player.name,
                position: filtered.length,
                notifiedAt: null,
              },
            ],
          }
        })
      }
      return updated
    })

    startTransition(async () => {
      try {
        await movePlayerToGroup(tournamentId, activeId, targetGroupId)
      } catch {
        router.refresh()
      }
    })
  }

  // ── Group CRUD ───────────────────────────────────────────────────────────

  function handleCreateGroup() {
    const name = `Group ${groups.length + 1}`
    const tempId = `temp-${Date.now()}`

    setGroups((prev) => [...prev, { id: tempId, name, teeTime: null, startingHole: null, lastNotifiedTeeTime: null, lastNotifiedStartHole: null, members: [] }])

    startTransition(async () => {
      try {
        const group = await createGroup(tournamentId, name)
        setGroups((prev) => prev.map((g) => (g.id === tempId ? { ...g, id: group.id } : g)))
      } catch {
        setGroups((prev) => prev.filter((g) => g.id !== tempId))
      }
    })
  }

  function handleDeleteGroup(groupId: string) {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return

    // Move members back to unassigned
    setPlayers((prev) =>
      prev.map((p) => (p.groupId === groupId ? { ...p, groupId: null } : p)),
    )
    setGroups((prev) => prev.filter((g) => g.id !== groupId))

    startTransition(async () => {
      try {
        await deleteGroup(tournamentId, groupId)
      } catch {
        router.refresh()
      }
    })
  }

  function startRenaming(groupId: string, currentName: string) {
    setEditingGroupId(groupId)
    setEditingGroupName(currentName)
  }

  function finishRenaming() {
    if (!editingGroupId || !editingGroupName.trim()) {
      setEditingGroupId(null)
      return
    }

    const gId = editingGroupId
    const newName = editingGroupName.trim()

    setGroups((prev) => prev.map((g) => (g.id === gId ? { ...g, name: newName } : g)))
    setEditingGroupId(null)

    startTransition(async () => {
      try {
        await renameGroup(tournamentId, gId, newName)
      } catch {
        router.refresh()
      }
    })
  }

  // ── Add / Remove Players ─────────────────────────────────────────────────

  function handleAddPlayer() {
    setAddError('')
    setAddSuccess('')

    startTransition(async () => {
      const result = await addLatePlayer(tournamentId, addEmail)
      if (!result.ok) {
        setAddError(result.error ?? 'Failed to add player.')
        return
      }
      setAddSuccess(`Added ${result.player!.name}`)
      setPlayers((prev) => [
        ...prev,
        { id: result.player!.id, name: result.player!.name, email: addEmail, handicap: result.player!.handicap, groupId: null },
      ])
      setAddEmail('')
    })
  }

  function handleRemovePlayer() {
    if (!removeConfirmId) return
    const pid = removeConfirmId
    const player = players.find((p) => p.id === pid)

    setPlayers((prev) => prev.filter((p) => p.id !== pid))
    if (player?.groupId) {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === player.groupId
            ? { ...g, members: g.members.filter((m) => m.tournamentPlayerId !== pid) }
            : g,
        ),
      )
    }
    setRemoveConfirmId(null)

    startTransition(async () => {
      try {
        await removePlayer(tournamentId, pid)
      } catch {
        router.refresh()
      }
    })
  }

  // ── Tee Time / Starting Hole ─────────────────────────────────────────────

  function handleTeeTimeChange(groupId: string, value: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, teeTime: value || null } : g)))

    startTransition(async () => {
      try {
        await updateGroupTeeTime(tournamentId, groupId, value || null)
      } catch {
        router.refresh()
      }
    })
  }

  function handleStartingHoleChange(groupId: string, value: string) {
    const hole = value ? parseInt(value) : null
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, startingHole: hole } : g)))

    startTransition(async () => {
      try {
        await updateGroupStartingHole(tournamentId, groupId, hole)
      } catch {
        router.refresh()
      }
    })
  }

  // ── Notify ───────────────────────────────────────────────────────────────

  function getAffectedCount(): number {
    let count = 0
    for (const group of groups) {
      const teeTimeChanged = group.teeTime !== group.lastNotifiedTeeTime
      const startHoleChanged = group.startingHole !== group.lastNotifiedStartHole
      for (const member of group.members) {
        if (!member.notifiedAt || teeTimeChanged || startHoleChanged) {
          count++
        }
      }
    }
    return count
  }

  function handleDismissVacancy(vacancyId: string) {
    setVacancies((prev) => prev.filter((v) => v.id !== vacancyId))
    startTransition(async () => {
      try {
        await dismissVacancy(vacancyId, slug)
        router.refresh()
      } catch {
        // Roll back optimistic update on failure
        const original = initialVacancies.find((v) => v.id === vacancyId)
        if (original) setVacancies((prev) => [original, ...prev])
      }
    })
  }

  function handleDismissAllVacancies() {
    const snapshot = vacancies
    setVacancies([])
    startTransition(async () => {
      try {
        await dismissAllVacancies(tournamentId, slug)
        router.refresh()
      } catch {
        setVacancies(snapshot)
      }
    })
  }

  function handleNotifyAffected() {
    setMessage(null)
    startTransition(async () => {
      const result = await notifyAffectedPlayers(tournamentId, slug)
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error ?? 'Something went wrong.' })
        return
      }
      if (result.count === 0) {
        setMessage({ type: 'success', text: 'No changes to notify — all players are up to date.' })
      } else {
        setMessage({ type: 'success', text: `Notifications sent to ${result.count} player${result.count !== 1 ? 's' : ''}.` })
      }
      router.refresh()
    })
  }

  function handleNotifyAll() {
    setMessage(null)
    startTransition(async () => {
      const result = await notifyAllPlayers(tournamentId, slug)
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error ?? 'Something went wrong.' })
        return
      }
      setMessage({ type: 'success', text: `Notifications sent to ${result.count} player${result.count !== 1 ? 's' : ''}.` })
      router.refresh()
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function parseTeeTime(teeTime: string | null): { hour: string; minute: string; period: 'AM' | 'PM' } {
    if (!teeTime) return { hour: '', minute: '', period: 'AM' }
    try {
      let h24: number
      let min: number

      // Handle "HH:mm" format (from local state after user edits)
      const hhmm = teeTime.match(/^(\d{1,2}):(\d{2})$/)
      if (hhmm) {
        h24 = parseInt(hhmm[1])
        min = parseInt(hhmm[2])
      } else {
        // Handle ISO date string (from server)
        const d = new Date(teeTime)
        if (isNaN(d.getTime())) return { hour: '', minute: '', period: 'AM' }
        h24 = d.getHours()
        min = d.getMinutes()
      }

      const period = h24 >= 12 ? 'PM' as const : 'AM' as const
      const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
      return { hour: String(h12), minute: String(min).padStart(2, '0'), period }
    } catch {
      return { hour: '', minute: '', period: 'AM' }
    }
  }

  function buildTimeString(hour: string, minute: string, period: 'AM' | 'PM'): string | null {
    if (!hour || !minute) return null
    let h24 = parseInt(hour)
    if (period === 'AM' && h24 === 12) h24 = 0
    else if (period === 'PM' && h24 !== 12) h24 += 12
    return `${String(h24).padStart(2, '0')}:${minute}`
  }

  const playerForRemove = players.find((p) => p.id === removeConfirmId)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="space-y-6">
      {/* Vacancy alerts — players with assigned tee times who unregistered */}
      {vacancies.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-4 border-b border-amber-200 dark:border-amber-800/60">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {vacancies.length} player{vacancies.length === 1 ? '' : 's'} dropped from an assigned group
              </p>
            </div>
            {vacancies.length > 1 && (
              <button
                type="button"
                onClick={handleDismissAllVacancies}
                disabled={isPending}
                className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors shrink-0"
              >
                Dismiss all
              </button>
            )}
          </div>
          <ul className="divide-y divide-amber-200 dark:divide-amber-800/60">
            {vacancies.map((v) => {
              const teeTimeStr = v.teeTime
                ? new Date(v.teeTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : null
              const meta = [teeTimeStr, v.startingHole ? `Hole ${v.startingHole}` : null].filter(Boolean).join(' · ')
              return (
                <li key={v.id} className="px-4 py-2.5 flex items-center justify-between gap-4">
                  <p className="text-sm text-amber-900 dark:text-amber-100 min-w-0">
                    <span className="font-semibold">{v.playerName}</span>
                    <span className="text-amber-700 dark:text-amber-300"> unregistered from </span>
                    <span className="font-semibold">{v.groupName}</span>
                    {meta && <span className="text-amber-700 dark:text-amber-300"> ({meta})</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDismissVacancy(v.id)}
                    disabled={isPending}
                    className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors shrink-0"
                  >
                    Dismiss
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/admin`}
          className="shrink-0 w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-heading font-bold truncate">Manage Groups</h1>
          <p className="text-xs text-muted-foreground">{tournamentName}</p>
        </div>
      </div>

      {/* Player count + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{players.length}</span> player{players.length !== 1 ? 's' : ''} registered
          {unassigned.length > 0 && (
            <span> &middot; <span className="text-amber-600 dark:text-amber-400">{unassigned.length} unassigned</span></span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAutoAssignOpen(true)} disabled={players.length === 0}>
            <Wand2 className="w-4 h-4 mr-1.5" />
            Generate Groups
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setAddDialogOpen(true); setAddError(''); setAddSuccess(''); setAddEmail('') }}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add Player
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <p className="text-xs text-muted-foreground">Drag players onto a group, or tap to select then tap a group. Max 4 per group.</p>

      {/* Unassigned pool */}
      <DroppableArea id={UNASSIGNED_DROPPABLE_ID}>
      <Card>
        <CardHeader
          className={`pb-3 transition-colors rounded-t-xl ${selectedPlayerIds.size > 0 && ![...selectedPlayerIds].every((id) => unassigned.find((p) => p.id === id)) ? 'cursor-pointer hover:bg-[var(--color-primary)]/5 ring-2 ring-[var(--color-primary)]/30' : ''}`}
          onClick={() => handleGroupTap(null)}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Unassigned Players
            <span className="text-xs font-normal text-muted-foreground">({unassigned.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unassigned.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">All players are assigned to groups.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unassigned.map((p) => {
                const tier = handicapTier(p.handicap)
                return (
                  <DraggablePill
                    key={p.id}
                    id={p.id}
                    onClick={() => handlePlayerTap(p.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all select-none ${
                      selectedPlayerIds.has(p.id)
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-2 ring-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'border-border hover:border-[var(--color-primary)]/40 hover:bg-muted'
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>
                      {p.handicap}
                    </span>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); setRemoveConfirmId(p.id) }}
                      className="ml-0.5 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </DraggablePill>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </DroppableArea>

      {selectedPlayerIds.size > 0 && (
        <p className="text-xs text-center text-[var(--color-primary)] font-medium animate-pulse">
          {selectedPlayerIds.size === 1
            ? `Tap a group to move ${players.find((p) => selectedPlayerIds.has(p.id))?.name ?? 'player'} there`
            : `Tap a group to move ${selectedPlayerIds.size} players there`}
        </p>
      )}

      {/* Groups */}
      <div className="space-y-4">
        {groups.map((group) => (
          <DroppableArea key={group.id} id={group.id}>
          <Card
            className={`group transition-all ${selectedPlayerIds.size > 0 && group.members.length < 4 && ![...selectedPlayerIds].every((id) => group.members.find((m) => m.tournamentPlayerId === id)) ? 'ring-2 ring-[var(--color-primary)]/30 cursor-pointer hover:ring-[var(--color-primary)]' : ''}`}
            onClick={() => {
              if (selectedPlayerIds.size > 0 && group.members.length < 4) {
                handleGroupTap(group.id)
              }
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {editingGroupId === group.id ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && finishRenaming()}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 text-sm w-36"
                        autoFocus
                      />
                      <button onClick={finishRenaming} className="p-1 rounded hover:bg-muted">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      {group.name}
                      <button
                        onClick={(e) => { e.stopPropagation(); startRenaming(group.id, group.name) }}
                        className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </CardTitle>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    group.members.length >= 4
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {group.members.length}/4
                  </span>
                  {(() => {
                    const teeTimeChanged = group.teeTime !== group.lastNotifiedTeeTime
                    const startHoleChanged = group.startingHole !== group.lastNotifiedStartHole
                    const hasUnsent = group.members.some((m) => !m.notifiedAt || teeTimeChanged || startHoleChanged)
                    return hasUnsent && group.members.length > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        unsent
                      </span>
                    ) : null
                  })()}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id) }}
                  className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Members */}
              {group.members.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">No players assigned yet. Tap a player then tap this group.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {group.members
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((m) => {
                    const p = players.find((pl) => pl.id === m.tournamentPlayerId)
                    const tier = p ? handicapTier(p.handicap) : null
                    return (
                      <DraggablePill
                        key={m.tournamentPlayerId}
                        id={m.tournamentPlayerId}
                        onClick={() => handlePlayerTap(m.tournamentPlayerId)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all select-none ${
                          selectedPlayerIds.has(m.tournamentPlayerId)
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-2 ring-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'border-border hover:border-[var(--color-primary)]/40'
                        }`}
                      >
                        <span className="font-medium">{m.name}</span>
                        {p && tier && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>
                            {p.handicap}
                          </span>
                        )}
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); handleRemoveFromGroup(m.tournamentPlayerId) }}
                          className="ml-0.5 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </DraggablePill>
                    )
                  })}
                </div>
              )}

              {/* Tee time + Starting hole */}
              <div className="space-y-3 pt-1 border-t border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Optional fields</p>
              {(() => {
                const parsed = parseTeeTime(group.teeTime)
                const selectClass = "flex h-11 md:h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                return (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" /> Tee Time
                      </Label>
                      <div className="grid grid-cols-3 gap-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={parsed.hour}
                          onChange={(e) => {
                            const t = buildTimeString(e.target.value, parsed.minute || '00', parsed.period)
                            handleTeeTimeChange(group.id, t ?? '')
                          }}
                          className={selectClass}
                        >
                          <option value="">Hr</option>
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                        <select
                          value={parsed.minute}
                          onChange={(e) => {
                            const t = buildTimeString(parsed.hour || '12', e.target.value, parsed.period)
                            handleTeeTimeChange(group.id, t ?? '')
                          }}
                          className={selectClass}
                        >
                          <option value="">Min</option>
                          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                            <option key={m} value={m}>:{m}</option>
                          ))}
                        </select>
                        <select
                          value={parsed.hour ? parsed.period : ''}
                          onChange={(e) => {
                            const t = buildTimeString(parsed.hour || '12', parsed.minute || '00', e.target.value as 'AM' | 'PM')
                            handleTeeTimeChange(group.id, t ?? '')
                          }}
                          className={selectClass}
                        >
                          <option value="">--</option>
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Flag className="w-3 h-3" /> Starting Hole
                      </Label>
                      <select
                        value={group.startingHole ?? ''}
                        onChange={(e) => { handleStartingHoleChange(group.id, e.target.value) }}
                        onClick={(e) => e.stopPropagation()}
                        className={selectClass + ' w-full'}
                      >
                        <option value="">--</option>
                        {Array.from({ length: 18 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>Hole {i + 1}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })()}
              </div>
            </CardContent>
          </Card>
          </DroppableArea>
        ))}
      </div>

      {/* + New Group */}
      <Button variant="outline" className="w-full" onClick={handleCreateGroup}>
        <Plus className="w-4 h-4 mr-1.5" />
        New Group
      </Button>

      {/* Notify Players */}
      {groups.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border">
          {(() => {
            const affected = getAffectedCount()
            return (
              <>
                <Button
                  className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
                  onClick={handleNotifyAffected}
                  disabled={isPending}
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  {isPending ? 'Sending...' : affected > 0 ? `Notify ${affected} Affected Player${affected !== 1 ? 's' : ''}` : 'Notify Players'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleNotifyAll}
                  disabled={isPending}
                >
                  {isPending ? 'Sending...' : 'Notify All Players'}
                </Button>
              </>
            )
          })()}
          {message && (
            <p className={`text-sm text-center ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
              {message.text}
            </p>
          )}
        </div>
      )}

      {/* Auto-assign Dialog */}
      <GroupAutoAssignDialog
        open={autoAssignOpen}
        onOpenChange={setAutoAssignOpen}
        tournamentId={tournamentId}
        isLeague={isLeague}
        participantCount={players.length}
        onAssigned={({ groupCount, conflicts }) => {
          setMessage({
            type: 'success',
            text:
              conflicts > 0
                ? `Generated ${groupCount} groups — ${conflicts} repeat pairing${conflicts === 1 ? '' : 's'} couldn't be avoided.`
                : `Generated ${groupCount} groups.`,
          })
          router.refresh()
        }}
      />

      {/* Add Player Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Player</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="addEmail">Player Email</Label>
              <Input
                id="addEmail"
                type="email"
                placeholder="player@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail && handleAddPlayer()}
              />
            </div>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
            {addSuccess && <p className="text-sm text-green-600 dark:text-green-400">{addSuccess}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPlayer} disabled={!addEmail || isPending}>
              {isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Player Confirmation */}
      <Dialog open={!!removeConfirmId} onOpenChange={(open) => !open && setRemoveConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Player</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove <strong>{playerForRemove?.name}</strong> from this tournament?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemovePlayer} disabled={isPending}>
              {isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    <DragOverlay>
      {draggedPlayer ? (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border-2 border-[var(--color-primary)] bg-background shadow-lg cursor-grabbing">
          <span className="font-medium">{draggedPlayer.name}</span>
          {(() => {
            const tier = handicapTier(draggedPlayer.handicap)
            return (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>
                {draggedPlayer.handicap}
              </span>
            )
          })()}
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}
