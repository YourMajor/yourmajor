'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Globe, Link2, Lock, Mail } from 'lucide-react'

export type TournamentTypeValue = 'PUBLIC' | 'OPEN' | 'INVITE'

export type InviteEntry = { type: 'email'; value: string } | { type: 'phone'; value: string }

export interface TournamentTypeState {
  tournamentType: TournamentTypeValue
  inviteEmails: string[]
  inviteList: InviteEntry[]
}

interface Props {
  value: TournamentTypeState
  onChange: (v: TournamentTypeState) => void
}

const TYPES = [
  {
    id: 'PUBLIC' as const,
    name: 'Public',
    icon: Globe,
    description: 'Listed in "Open Near You" for anyone to discover and join. Players can play their round anytime within the tournament window — no fixed round dates needed. Powerups are disabled.',
  },
  {
    id: 'OPEN' as const,
    name: 'Open Registration',
    icon: Link2,
    description: 'Anyone with the tournament link can register. Rounds have specific dates. Full feature access including powerups.',
  },
  {
    id: 'INVITE' as const,
    name: 'Invite Only',
    icon: Lock,
    description: 'Only players you invite can register. Rounds have specific dates. Full feature access including powerups.',
  },
] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function StepTournamentType({ value, onChange }: Props) {
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')

  const inviteList = value.inviteList ?? []

  function set(type: TournamentTypeValue) {
    onChange({ ...value, tournamentType: type })
  }

  function addEmail() {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed) return

    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Enter a valid email address.')
      return
    }

    if (inviteList.some((e) => e.value === trimmed)) {
      setEmailError('Already added.')
      return
    }

    setEmailError('')
    const entry: InviteEntry = { type: 'email', value: trimmed }
    onChange({
      ...value,
      inviteList: [...inviteList, entry],
      inviteEmails: [...value.inviteEmails, trimmed],
    })
    setEmailInput('')
  }

  function removeEntry(entryValue: string) {
    onChange({
      ...value,
      inviteList: inviteList.filter((e) => e.value !== entryValue),
      inviteEmails: value.inviteEmails.filter((e) => e !== entryValue),
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose how players will find and join your tournament.</p>

      <div className="space-y-3">
        {TYPES.map((t) => {
          const Icon = t.icon
          const selected = value.tournamentType === t.id
          return (
            <Card
              key={t.id}
              onClick={() => set(t.id)}
              className={`cursor-pointer transition-all ${selected ? 'ring-2 ring-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'hover:bg-muted/40'}`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="tournamentType"
                    value={t.id}
                    checked={selected}
                    onChange={() => set(t.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <Icon className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Invite list — shown inline when Invite Only is selected */}
      {value.tournamentType === 'INVITE' && (
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Optionally invite players now, or skip and invite them later from the tournament admin settings.
          </p>

          {/* Email invites */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Invite by Email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="player@example.com"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setEmailError('') }}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={addEmail}>Add</Button>
            </div>
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>

          {/* Invite list */}
          {inviteList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {inviteList.map((entry) => (
                <Badge key={entry.value} variant="secondary" className="gap-1 pr-1">
                  <Mail className="w-3 h-3" />
                  {entry.value}
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.value)}
                    className="ml-0.5 hover:text-destructive text-xs leading-none"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
