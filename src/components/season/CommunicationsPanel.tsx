'use client'

import { useState, useTransition } from 'react'
import { Send, Mail, MessageSquare, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendLeagueAnnouncement } from '@/app/[slug]/admin/season/communications-actions'
import type { AnnouncementChannel } from '@/lib/league-announcements'

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
}

interface Props {
  tournamentId: string
  slug: string
  rosterCount: number
  rosterActiveCount: number
  history: AnnouncementHistoryItem[]
}

type Audience = 'ALL_ACTIVE' | 'ALL_ROSTER'

export function CommunicationsPanel({ tournamentId, slug, rosterCount, rosterActiveCount, history }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<Audience>('ALL_ACTIVE')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const audienceCount = audience === 'ALL_ACTIVE' ? rosterActiveCount : rosterCount
  const channels: AnnouncementChannel[] = [
    ...(emailEnabled ? ['EMAIL' as const] : []),
    ...(smsEnabled ? ['SMS' as const] : []),
  ]

  function handleSend() {
    setResult(null)
    if (!subject.trim()) {
      setResult({ type: 'error', text: 'Subject is required.' })
      return
    }
    if (!body.trim()) {
      setResult({ type: 'error', text: 'Body is required.' })
      return
    }
    if (channels.length === 0) {
      setResult({ type: 'error', text: 'Select at least one channel.' })
      return
    }

    startTransition(async () => {
      const r = await sendLeagueAnnouncement({
        tournamentId,
        slug,
        subject,
        body,
        channels,
        audienceFilter: { type: audience },
      })
      if (!r.ok) {
        setResult({ type: 'error', text: r.error })
        return
      }
      setResult({
        type: 'success',
        text: `Sent to ${r.successCount} of ${r.deliveryCount} recipients.`,
      })
      setSubject('')
      setBody('')
    })
  }

  return (
    <div className="mt-4 space-y-8">
      {/* Composer */}
      <section className="rounded-xl border border-border p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Send announcement</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reach the league roster by email and/or SMS. Per-recipient delivery is logged below.
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
            Sending to {audienceCount} member{audienceCount === 1 ? '' : 's'} via {channels.length} channel
            {channels.length === 1 ? '' : 's'}.
          </p>
          <Button onClick={handleSend} disabled={isPending}>
            <Send className="w-4 h-4 mr-1.5" />
            {isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </section>

      {/* History */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Recent announcements</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Last 25 blasts.</p>
        </div>
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No announcements sent yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((item) => (
              <li key={item.id} className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{item.subject}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.bodyPreview}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(item.sentAt ?? item.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    {item.sentByName && (
                      <p className="text-[11px] text-muted-foreground">{item.sentByName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  {item.channels.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 text-muted-foreground"
                    >
                      {c === 'EMAIL' ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                      {c.toLowerCase()}
                    </span>
                  ))}
                  <span className="text-muted-foreground">·</span>
                  <span className={item.successCount === item.deliveryCount ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                    {item.successCount}/{item.deliveryCount} delivered
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
