'use client'

import { useState, useTransition } from 'react'
import { Users, Calendar, Settings, Check, X, UserMinus, UserPlus, MapPin } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { updateRosterMemberStatus, removeRosterMember, toggleAutoAddNew, updateSeasonConfig } from '@/lib/roster-actions'
import { scheduleLeagueEvent } from '@/lib/league-event-actions'
import { CourseSearchCombobox } from '@/components/wizard/CourseSearchCombobox'
import type { AttendanceRow, SeasonEvent, CourseAnalytics } from '@/lib/season-standings'

interface RosterMember {
  id: string
  userId: string
  status: string
  joinedAt: string
  name: string
  email: string
  avatar: string | null
  handicap: number
}

interface RosterData {
  id: string
  autoAddNew: boolean
  members: RosterMember[]
}

interface ScheduleEvent {
  id: string
  title: string
  date: string
  courseId: string | null
  notes: string | null
  rsvps: { userId: string; name: string; status: string }[]
}

interface LeagueInfo {
  courseName: string | null
  courseId: string | null
  playerCount: number
  leagueName: string
}

interface SeasonAdminDashboardProps {
  tournamentId: string
  roster: RosterData | null
  attendance: { rows: AttendanceRow[]; events: SeasonEvent[] }
  courseAnalytics: CourseAnalytics[]
  seasonConfig: {
    scoringMethod: string | null
    bestOf: number | null
    pointsTable: Record<number, number> | null
  }
  schedule: ScheduleEvent[]
  leagueInfo: LeagueInfo | null
  slug: string
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export function SeasonAdminDashboard({
  tournamentId,
  roster,
  attendance,
  courseAnalytics,
  seasonConfig,
  schedule,
  leagueInfo,
  slug,
}: SeasonAdminDashboardProps) {
  return (
    <Tabs defaultValue={leagueInfo ? 'events' : 'roster'}>
      <TabsList variant="line">
        {leagueInfo && <TabsTrigger value="events">Events</TabsTrigger>}
        <TabsTrigger value="roster">Roster</TabsTrigger>
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
        <TabsTrigger value="courses">Course Stats</TabsTrigger>
        <TabsTrigger value="config">Season Config</TabsTrigger>
      </TabsList>

      {leagueInfo && (
        <TabsContent value="events">
          <ScheduleEventsPanel
            tournamentId={tournamentId}
            leagueInfo={leagueInfo}
            schedule={schedule}
            slug={slug}
            rosterCount={roster?.members.filter((m) => m.status === 'ACTIVE').length ?? 0}
          />
        </TabsContent>
      )}

      <TabsContent value="roster">
        <RosterPanel tournamentId={tournamentId} roster={roster} />
      </TabsContent>

      <TabsContent value="attendance">
        <AttendancePanel attendance={attendance} />
      </TabsContent>

      <TabsContent value="courses">
        <CourseStatsPanel courseAnalytics={courseAnalytics} />
      </TabsContent>

      <TabsContent value="config">
        <SeasonConfigPanel tournamentId={tournamentId} config={seasonConfig} />
      </TabsContent>
    </Tabs>
  )
}

// ─── Roster Panel ────────────────────────────────────────────────────────────

function RosterPanel({ tournamentId, roster }: { tournamentId: string; roster: RosterData | null }) {
  const [isPending, startTransition] = useTransition()

  if (!roster) {
    return <p className="py-8 text-center text-muted-foreground">No roster available. Create a linked tournament to enable roster management.</p>
  }

  const activeMembers = roster.members.filter((m) => m.status === 'ACTIVE')
  const inactiveMembers = roster.members.filter((m) => m.status === 'INACTIVE')

  return (
    <div className="mt-4 space-y-6">
      {/* Auto-add toggle */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Auto-add new players</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically add players who join any league event to the roster
          </p>
        </div>
        <button
          disabled={isPending}
          onClick={() => startTransition(() => toggleAutoAddNew(tournamentId, !roster.autoAddNew))}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            roster.autoAddNew ? 'bg-[var(--color-primary)]' : 'bg-muted'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
            roster.autoAddNew ? 'translate-x-5' : ''
          }`} />
        </button>
      </div>

      {/* Active members */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Active Members ({activeMembers.length})</h3>
        </div>
        <div className="space-y-1">
          {activeMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar size="sm">
                  <AvatarImage src={member.avatar ?? undefined} alt={member.name} />
                  <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                  <p className="text-[11px] text-muted-foreground">{member.email} &middot; HCP {member.handicap}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => updateRosterMemberStatus(tournamentId, member.id, 'INACTIVE'))}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Mark inactive"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => removeRosterMember(tournamentId, member.id))}
                  className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove from roster"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inactive members */}
      {inactiveMembers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Inactive ({inactiveMembers.length})</h3>
          <div className="space-y-1">
            {inactiveMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar size="sm">
                    <AvatarImage src={member.avatar ?? undefined} alt={member.name} />
                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => updateRosterMemberStatus(tournamentId, member.id, 'ACTIVE'))}
                  className="p-1.5 rounded text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors"
                  title="Reactivate"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Attendance Panel ────────────────────────────────────────────────────────

function AttendancePanel({ attendance }: { attendance: { rows: AttendanceRow[]; events: SeasonEvent[] } }) {
  if (attendance.rows.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No attendance data yet.</p>
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 font-semibold text-foreground sticky left-0 bg-background z-10">Player</th>
            {attendance.events.map((e) => (
              <th key={e.tournamentId} className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[4rem]">
                <span className="text-[11px] block">{e.name}</span>
                {e.date && <span className="text-[9px] text-muted-foreground">{new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
              </th>
            ))}
            <th className="text-center py-2 px-3 font-semibold text-foreground">%</th>
          </tr>
        </thead>
        <tbody>
          {attendance.rows.map((row) => (
            <tr key={row.userId} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-2 px-3 sticky left-0 bg-background z-10">
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarImage src={row.avatarUrl ?? undefined} />
                    <AvatarFallback>{getInitials(row.playerName)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground truncate max-w-[120px]">{row.playerName}</span>
                </div>
              </td>
              {row.events.map((e) => (
                <td key={e.tournamentId} className="text-center py-2 px-2">
                  {e.attended
                    ? <Check className="w-4 h-4 text-green-600 mx-auto" />
                    : <X className="w-4 h-4 text-red-400 mx-auto" />
                  }
                </td>
              ))}
              <td className="text-center py-2 px-3">
                <Badge variant={row.attendancePct === 100 ? 'default' : row.attendancePct >= 75 ? 'secondary' : 'outline'}>
                  {Math.round(row.attendancePct)}%
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Course Stats Panel ──────────────────────────────────────────────────────

function CourseStatsPanel({ courseAnalytics }: { courseAnalytics: CourseAnalytics[] }) {
  const [selectedCourse, setSelectedCourse] = useState(0)

  if (courseAnalytics.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No course data available yet.</p>
  }

  const course = courseAnalytics[selectedCourse]

  return (
    <div className="mt-4 space-y-4">
      {courseAnalytics.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {courseAnalytics.map((c, i) => (
            <button
              key={c.courseId}
              onClick={() => setSelectedCourse(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                i === selectedCourse
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.courseName}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
            {course.courseName}
          </h3>
          <p className="text-xs text-muted-foreground">Played {course.timesPlayed} time{course.timesPlayed !== 1 ? 's' : ''} this season</p>
        </div>
        {course.courseRecord && (
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Course Record</p>
            <p className="text-lg font-bold text-foreground">{course.courseRecord.total}</p>
            <p className="text-[11px] text-muted-foreground">{course.courseRecord.playerName}</p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 font-semibold">Hole</th>
              <th className="text-center py-2 px-2 font-semibold">Par</th>
              <th className="text-center py-2 px-2 font-semibold">Avg</th>
              <th className="text-center py-2 px-2 font-semibold">vs Par</th>
              <th className="text-center py-2 px-2 font-semibold">Birdie %</th>
              <th className="text-center py-2 px-2 font-semibold">Bogey %</th>
              <th className="text-center py-2 px-2 font-semibold">Difficulty</th>
            </tr>
          </thead>
          <tbody>
            {course.holes.map((hole) => (
              <tr key={hole.holeNumber} className="border-b border-border/50">
                <td className="py-2 px-2 font-medium">{hole.holeNumber}</td>
                <td className="text-center py-2 px-2">{hole.par}</td>
                <td className="text-center py-2 px-2 font-medium">{hole.avgScore.toFixed(1)}</td>
                <td className={`text-center py-2 px-2 font-semibold ${
                  hole.avgVsPar > 0.3 ? 'text-red-500' : hole.avgVsPar < -0.1 ? 'text-green-600' : 'text-foreground'
                }`}>
                  {hole.avgVsPar > 0 ? '+' : ''}{hole.avgVsPar.toFixed(2)}
                </td>
                <td className="text-center py-2 px-2 text-green-600">{hole.birdieRate}%</td>
                <td className="text-center py-2 px-2 text-red-500">{hole.bogeyRate}%</td>
                <td className="text-center py-2 px-2">
                  <Badge variant={hole.hardestRank <= 3 ? 'destructive' : hole.hardestRank <= 6 ? 'outline' : 'secondary'}>
                    #{hole.hardestRank}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Season Config Panel ─────────────────────────────────────────────────────

function SeasonConfigPanel({
  tournamentId,
  config,
}: {
  tournamentId: string
  config: { scoringMethod: string | null; bestOf: number | null; pointsTable: Record<number, number> | null }
}) {
  const [method, setMethod] = useState(config.scoringMethod ?? 'POINTS')
  const [bestOf, setBestOf] = useState(config.bestOf ?? '')
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const methods = [
    { value: 'POINTS', label: 'Points-Based', desc: 'Award points per finish position (1st = 25, 2nd = 20, etc.)' },
    { value: 'STROKE_AVG', label: 'Stroke Average', desc: 'Average net score vs par across all events' },
    { value: 'BEST_OF_N', label: 'Best N of M', desc: 'Only count the best N results (forgives absences)' },
    { value: 'STABLEFORD_CUMULATIVE', label: 'Cumulative Stableford', desc: 'Sum of Stableford points across all events' },
  ]

  function handleSave() {
    startTransition(async () => {
      await updateSeasonConfig(tournamentId, {
        seasonScoringMethod: method,
        seasonBestOf: bestOf ? Number(bestOf) : null,
        seasonPointsTable: null, // Use defaults for now
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="mt-4 space-y-6 max-w-lg">
      <div>
        <label className="text-sm font-semibold text-foreground block mb-2">
          <Settings className="w-4 h-4 inline mr-1.5 text-muted-foreground" />
          Scoring Method
        </label>
        <div className="space-y-2">
          {methods.map((m) => (
            <button
              key={m.value}
              onClick={() => setMethod(m.value)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                method === m.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-border hover:border-[var(--color-primary)]/40'
              }`}
            >
              <p className="text-sm font-medium text-foreground">{m.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {(method === 'BEST_OF_N' || method === 'POINTS' || method === 'STABLEFORD_CUMULATIVE') && (
        <div>
          <label className="text-sm font-semibold text-foreground block mb-1.5">
            {method === 'BEST_OF_N' ? 'Count Best N Results' : 'Count Best N Results (optional)'}
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Leave blank to count all events. Set a number to only count the best N.
          </p>
          <input
            type="number"
            min={1}
            max={50}
            value={bestOf}
            onChange={(e) => setBestOf(e.target.value ? Number(e.target.value) : '')}
            placeholder="e.g., 10"
            className="w-24 px-3 py-2 rounded-lg border border-border text-sm bg-background text-foreground"
          />
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {saved ? 'Saved!' : isPending ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  )
}

// ─── Schedule Events Panel ───────────────────────────────────────────────────

function ScheduleEventsPanel({
  tournamentId,
  leagueInfo,
  schedule,
  rosterCount,
}: {
  tournamentId: string
  leagueInfo: LeagueInfo
  schedule: ScheduleEvent[]
  slug: string
  rosterCount: number
}) {
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [useDifferentCourse, setUseDifferentCourse] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<{ id: string; name: string; par: number; teeOptions: { id: string; name: string; color: string | null }[] } | null>(null)
  const [createdSlug, setCreatedSlug] = useState<string | null>(null)
  const [error, setError] = useState('')

  function handleSchedule() {
    if (!date) { setError('Please select a date.'); return }
    if (useDifferentCourse && !selectedCourse) { setError('Please select a course.'); return }
    setError('')
    setCreatedSlug(null)

    startTransition(async () => {
      try {
        const result = await scheduleLeagueEvent(tournamentId, {
          date,
          notes: notes || undefined,
          courseId: useDifferentCourse && selectedCourse ? selectedCourse.id : undefined,
        })
        setCreatedSlug(result.slug)
        setDate('')
        setNotes('')
        setUseDifferentCourse(false)
        setSelectedCourse(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div className="mt-4 space-y-6">
      {/* Schedule new event card */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-5" style={{ backgroundColor: 'var(--color-primary)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">Schedule Next Event</p>
          <p className="text-lg font-heading font-bold text-white">{leagueInfo.leagueName}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Roster</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{rosterCount} players</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Auto-Register</p>
              <p className="text-sm font-medium text-green-600 mt-0.5">All active members</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Event Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              />
            </div>

            {/* Course selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Course</label>
              {!useDifferentCourse ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{leagueInfo.courseName ?? 'No course set'}</p>
                    <p className="text-xs text-muted-foreground">Same as previous event</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseDifferentCourse(true)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors text-foreground"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <CourseSearchCombobox
                    label=""
                    selected={selectedCourse}
                    onSelect={(c) => {
                      if (c) {
                        setSelectedCourse(c)
                      } else {
                        setSelectedCourse(null)
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => { setUseDifferentCourse(false); setSelectedCourse(null) }}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Use same course as last event
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Shotgun start at 5:30 PM"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            {createdSlug && (
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-4 py-3">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Event created! All active roster members have been registered.
                </p>
                <a
                  href={`/${createdSlug}/admin`}
                  className="text-xs font-semibold underline text-green-700 dark:text-green-300 mt-1 inline-block"
                >
                  View event admin &rarr;
                </a>
              </div>
            )}

            <button
              onClick={handleSchedule}
              disabled={isPending || !date || (useDifferentCourse && !selectedCourse)}
              className="w-full px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {isPending ? 'Creating Event...' : 'Schedule Event & Register Roster'}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Creates a new event linked to the season with the same settings and branding.
            All active roster members will be automatically registered.
          </p>
        </div>
      </div>

      {/* Existing scheduled events */}
      {schedule.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Scheduled Events
          </h3>
          <div className="space-y-2">
            {schedule.map((event) => {
              const going = event.rsvps.filter((r) => r.status === 'GOING')
              const notGoing = event.rsvps.filter((r) => r.status === 'NOT_GOING')
              const maybe = event.rsvps.filter((r) => r.status === 'MAYBE')

              return (
                <div key={event.id} className="rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="default">{going.length} going</Badge>
                      {maybe.length > 0 && <Badge variant="outline">{maybe.length} maybe</Badge>}
                      {notGoing.length > 0 && <Badge variant="secondary">{notGoing.length} out</Badge>}
                    </div>
                  </div>
                  {event.notes && <p className="text-xs text-muted-foreground">{event.notes}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
