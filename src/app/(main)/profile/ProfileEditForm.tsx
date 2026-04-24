'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { updateProfile } from './actions'

interface Props {
  initialName: string
  initialEmail: string
  initialHandicap: number
  initialPhone: string
  initialSmsNotifications: boolean
}

export function ProfileEditForm({ initialName, initialEmail, initialHandicap, initialPhone, initialSmsNotifications }: Props) {
  const parts = initialName.split(' ')
  const [firstName, setFirstName] = useState(parts[0] ?? '')
  const [lastName, setLastName] = useState(parts.slice(1).join(' '))
  const [email, setEmail] = useState(initialEmail)
  const [handicap, setHandicap] = useState(String(initialHandicap))
  const [phone, setPhone] = useState(initialPhone)
  const [smsNotifications, setSmsNotifications] = useState(initialSmsNotifications)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const formData = new FormData()
    formData.append('firstName', firstName)
    formData.append('lastName', lastName)
    formData.append('email', email)
    formData.append('handicap', handicap)
    formData.append('phone', phone)
    formData.append('smsNotifications', smsNotifications ? '1' : '0')

    const result = await updateProfile(formData)
    setSaving(false)

    if ('error' in result) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Profile updated' })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-heading">Edit Profile</CardTitle>
        <Link
          href="/profile"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </Link>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Name & email form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="handicap">Handicap Index</Label>
            <Input
              id="handicap"
              name="handicap"
              type="number"
              step="0.1"
              min="0"
              max="54"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
              className="w-28"
            />
            <p className="text-xs text-muted-foreground">
              Your official handicap index (0–54). Used for net scoring in tournaments.
            </p>
          </div>

          <Separator className="mt-2" />

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-56"
            />
            <p className="text-xs text-muted-foreground">
              Used for SMS notifications. Include country code (e.g. +1 for US).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="smsNotifications"
              name="smsNotifications"
              type="checkbox"
              checked={smsNotifications}
              onChange={(e) => setSmsNotifications(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="smsNotifications" className="text-sm font-normal cursor-pointer">
              Receive SMS notifications (draft turns, tee times)
            </Label>
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'error' ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
              {message.text}
            </p>
          )}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
