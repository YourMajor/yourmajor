'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export type RegistrationState = {
  isOpenRegistration: boolean
  inviteEmails: string[]
}

interface Props {
  value: RegistrationState
  onChange: (v: RegistrationState) => void
}

export function StepRegistration({ value, onChange }: Props) {
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')

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
      <p className="text-sm text-muted-foreground">Control who can register for this tournament.</p>

      <div className="space-y-3">
        <Card
          onClick={() => onChange({ ...value, isOpenRegistration: true })}
          className={`cursor-pointer transition-all ${value.isOpenRegistration ? 'ring-2 ring-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'hover:bg-muted/40'}`}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="regType"
                checked={value.isOpenRegistration}
                onChange={() => onChange({ ...value, isOpenRegistration: true })}
                className="mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold">Open Registration</p>
                <p className="text-xs text-muted-foreground mt-0.5">Any user with the tournament link can register themselves. Registration closes when the tournament starts.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => onChange({ ...value, isOpenRegistration: false })}
          className={`cursor-pointer transition-all ${!value.isOpenRegistration ? 'ring-2 ring-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'hover:bg-muted/40'}`}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="regType"
                checked={!value.isOpenRegistration}
                onChange={() => onChange({ ...value, isOpenRegistration: false })}
                className="mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold">Invite Only</p>
                <p className="text-xs text-muted-foreground mt-0.5">Players must receive an email invite. Only those with a valid invite link can register.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!value.isOpenRegistration && (
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
            Invite emails will be sent when you create the tournament. You can add more players later from the tournament hub.
          </p>
        </div>
      )}
    </div>
  )
}
