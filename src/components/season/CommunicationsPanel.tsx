'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Send,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  CalendarClock,
  Megaphone,
  Users as UsersIcon,
  XCircle,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  sendLeagueAnnouncement,
  scheduleLeagueAnnouncement,
  cancelScheduledAnnouncement,
} from '@/app/[slug]/admin/season/communications-actions'
import type {
  AnnouncementChannel,
  AnnouncementStatus,
  AnnouncementKind,
} from '@/lib/league-announcements'

export interface AnnouncementHistoryItem {
  id: string
  subject: string
  bodyPreview: string
  channels: AnnouncementChannel[]
  sentAt: string | null
  createdAt: string
  sentByName: string | null
  deliveryCount: number
  successCount: number
  status: AnnouncementStatus
  scheduledFor: string | null
  kind: AnnouncementKind
}

interface Props {
  tournamentId: string
  slug: string
  rosterCount: number
  rosterActiveCount: number
  history: AnnouncementHistoryItem[]
}

type Audience = 'ALL_ACTIVE' | 'ALL_ROSTER'
type SendTiming = 'NOW' | 'LATER'
type HistoryFilter = 'ALL' | 'BLAST' | 'TEE_TIME'

// Local time, formatted as YYYY-MM-DDTHH:mm — the value shape <input
// type="datetime-local"> emits and accepts.
function defaultScheduledFor(): string {
  const t = new Date(Date.now() + 60 * 60 * 1000) // one hour ahead
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function CommunicationsPanel({
  tournamentId,
  slug,
  rosterCount,
  rosterActiveCount,
  history,
}: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<Audience>('ALL_ACTIVE')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [timing, setTiming] = useState<SendTiming>('NOW')
  const [scheduledFor, setScheduledFor] = useState(defaultScheduledFor)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<HistoryFilter>('ALL')

  const audienceCount = audience === 'ALL_ACTIVE' ? rosterActiveCount : rosterCount
  const channels: AnnouncementChannel[] = useMemo(
    () => [
      ...(emailEnabled ? (['EMAIL'] as const) : []),
      ...(smsEnabled ? (['SMS'] as const) : []),
    ],
    [emailEnabled, smsEnabled],
  )

  function handleSubmit() {
    setResult(null)
    if (!subject.trim()) return setResult({ type: 'error', text: 'Subject is required.' })
    if (!body.trim()) return setResult({ type: 'error', text: 'Body is required.' })
    if (channels.length === 0) return setResult({ type: 'error', text: 'Select at least one channel.' })

    if (timing === 'LATER') {
      // datetime-local has no timezone, so it's interpreted as local time.
      const when = new Date(scheduledFor)
      if (Number.isNaN(when.getTime())) {
        return setResult({ type: 'error', text: 'Pick a valid date and time.' })
      }
      if (when.getTime() < Date.now() + 60_000) {
        return setResult({ type: 'error', text: 'Schedule time must be at least one minute in the future.' })
      }
    }

    startTransition(async () => {
      if (timing === 'NOW') {
        const r = await sendLeagueAnnouncement({
          tournamentId,
          slug,
          subject,
          body,
          channels,
          audienceFilter: { type: audience },
        })
        if (!r.ok) return setResult({ type: 'error', text: r.error })
        setResult({
          type: 'success',
          text: `Sent to ${r.successCount} of ${r.deliveryCount} recipients.`,
        })
      } else {
        const r = await scheduleLeagueAnnouncement({
          tournamentId,
          slug,
          subject,
          body,
          channels,
          audienceFilter: { type: audience },
          scheduledFor,
        })
        if (!r.ok) return setResult({ type: 'error', text: r.error })
        setResult({
          type: 'success',
          text: `Scheduled to send ${formatStamp(new Date(scheduledFor).toISOString())}.`,
        })
      }
      setSubject('')
      setBody('')
    })
  }

  const filtered = filter === 'ALL' ? history : history.filter((h) => h.kind === filter)

  return (
    <div className="space-y-8">
      {/* Composer */}
      <section className="rounded-xl border border-border p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Send announcement</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reach the league roster by email and/or SMS, immediately or on a schedule. Per-recipient delivery is logged below.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ann-subject">Subject</Label>
          <Input
            id="ann-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Tee time change for Saturday"
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ann-body">Message</Label>
          <textarea
            id="ann-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi everyone, the front nine is closed for cart-path-only..."
            rows={6}
            className="block w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-y"
          />
          <p className="text-[11px] text-muted-foreground">
            Plain text. Line breaks are preserved. SMS includes subject + body together.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Audience</Label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="ann-audience"
                  value="ALL_ACTIVE"
                  checked={audience === 'ALL_ACTIVE'}
                  onChange={() => setAudience('ALL_ACTIVE')}
                  className="h-4 w-4"
                />
                Active roster ({rosterActiveCount})
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="ann-audience"
                  value="ALL_ROSTER"
                  checked={audience === 'ALL_ROSTER'}
                  onChange={() => setAudience('ALL_ROSTER')}
                  className="h-4 w-4"
                />
                Full roster, including inactive ({rosterCount})
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                <Mail className="w-3.5 h-3.5" /> Email
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                <MessageSquare className="w-3.5 h-3.5" /> SMS (opted-in users with phone only)
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-2">
            <Label>When to send</Label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="ann-timing"
                  value="NOW"
                  checked={timing === 'NOW'}
                  onChange={() => setTiming('NOW')}
                  className="h-4 w-4"
                />
                <Send className="w-3.5 h-3.5" /> Send now
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="ann-timing"
                  value="LATER"
                  checked={timing === 'LATER'}
                  onChange={() => setTiming('LATER')}
                  className="h-4 w-4"
                />
                <CalendarClock className="w-3.5 h-3.5" /> Schedule for later
              </label>
            </div>
          </div>
          {timing === 'LATER' && (
            <div className="space-y-2">
              <Label htmlFor="ann-when">Send at</Label>
              <input
                id="ann-when"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="block w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Local time. Cron checks every five minutes, so actual send may be up to five minutes late.
              </p>
            </div>
          )}
        </div>

        {result && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm flex items-start gap-2 ${
              result.type === 'success'
                ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {result.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            {result.text}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {timing === 'NOW' ? 'Sending' : 'Scheduling'} to {audienceCount} member
            {audienceCount === 1 ? '' : 's'} via {channels.length} channel{channels.length === 1 ? '' : 's'}.
          </p>
          <Button onClick={handleSubmit} disabled={isPending}>
            {timing === 'NOW' ? <Send className="w-4 h-4 mr-1.5" /> : <CalendarClock className="w-4 h-4 mr-1.5" />}
            {isPending ? (timing === 'NOW' ? 'Sending…' : 'Scheduling…') : timing === 'NOW' ? 'Send' : 'Schedule'}
          </Button>
        </div>
      </section>

      {/* History — unified communication audit trail */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold">Communication history</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Outbound email/SMS, including admin announcements and tee-time notifications.
            </p>
          </div>
          <FilterChips value={filter} onChange={setFilter} />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {history.length === 0 ? 'No communications sent yet.' : 'Nothing matches this filter.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((item) => (
              <HistoryRow key={item.id} item={item} slug={slug} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function FilterChips({ value, onChange }: { value: HistoryFilter; onChange: (v: HistoryFilter) => void }) {
  const opts: { id: HistoryFilter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'BLAST', label: 'Announcements' },
    { id: 'TEE_TIME', label: 'Tee times' },
  ]
  return (
    <div className="inline-flex rounded-full border border-border bg-muted/30 p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-3 py-1 rounded-full transition-colors ${
            value === o.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function HistoryRow({ item, slug }: { item: AnnouncementHistoryItem; slug: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const KindIcon = item.kind === 'TEE_TIME' ? UsersIcon : Megaphone
  const stamp = item.scheduledFor && item.status === 'PENDING' ? item.scheduledFor : item.sentAt ?? item.createdAt

  function handleCancel() {
    setError(null)
    startTransition(async () => {
      const r = await cancelScheduledAnnouncement(item.id, slug)
      if (!r.ok) setError(r.error)
    })
  }

  return (
    <li className="rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
            <KindIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {item.subject}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.bodyPreview}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-muted-foreground">{formatStamp(stamp)}</p>
          {item.sentByName && <p className="text-[11px] text-muted-foreground">{item.sentByName}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        {item.channels.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 text-muted-foreground">
            {c === 'EMAIL' ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
            {c.toLowerCase()}
          </span>
        ))}
        <StatusChip item={item} />
        {item.status === 'PENDING' && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            {isPending ? 'Canceling…' : 'Cancel'}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  )
}

function StatusChip({ item }: { item: AnnouncementHistoryItem }) {
  if (item.status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        <CalendarClock className="w-3 h-3" />
        Scheduled
      </span>
    )
  }
  if (item.status === 'CANCELED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        <XCircle className="w-3 h-3" />
        Canceled
      </span>
    )
  }
  if (item.status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="w-3 h-3" />
        Failed
      </span>
    )
  }
  // SENT
  const allDelivered = item.deliveryCount > 0 && item.successCount === item.deliveryCount
  return (
    <span
      className={
        allDelivered
          ? 'text-green-600 dark:text-green-400'
          : 'text-amber-600 dark:text-amber-400'
      }
    >
      {item.successCount}/{item.deliveryCount} delivered
    </span>
  )
}
