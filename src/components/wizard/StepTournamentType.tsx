'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Globe, Link2, Lock } from 'lucide-react'

export type TournamentTypeValue = 'PUBLIC' | 'OPEN' | 'INVITE'

export interface TournamentTypeState {
  tournamentType: TournamentTypeValue
  inviteEmails: string[]
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
    description: 'Only players you invite by email can register. Rounds have specific dates. Full feature access including powerups.',
  },
] as const

export function StepTournamentType({ value, onChange }: Props) {
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')

  function set(type: TournamentTypeValue) {
    onChange({ ...value, tournamentType: type })
  }

  function addEmail() {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.')
      return
    }
    if (value.inviteEmails.includes(email)) {
      setEmailError('Already added.')
      return
    }
    setEmailError('')
    onChange({ ...value, inviteEmails: [...value.inviteEmails, email] })
    setEmailInput('')
  }

  function removeEmail(email: string) {
    onChange({ ...value, inviteEmails: value.inviteEmails.filter((e) => e !== email) })
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

      {/* Invite emails — shown inline when Invite Only is selected */}
      {value.tournamentType === 'INVITE' && (
        <div className="space-y-3 pt-2">
          <Label>Invite Players by Email</Label>
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
          {value.inviteEmails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.inviteEmails.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1 pr-1">
                  {email}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="ml-0.5 hover:text-destructive text-xs leading-none"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Invite emails will be sent when you create the tournament. You can add more later from the tournament hub.
          </p>
        </div>
      )}
    </div>
  )
}
