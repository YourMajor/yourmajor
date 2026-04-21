'use client'

import { useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AvatarCropDialog } from '@/components/profile/AvatarCropDialog'
import { updateProfile } from './actions'

interface Props {
  initialName: string
  initialEmail: string
  initialAvatarUrl: string | null
  initialHandicap: number
  initialPhone: string
  initialSmsNotifications: boolean
}

export function ProfileEditForm({ initialName, initialEmail, initialAvatarUrl, initialHandicap, initialPhone, initialSmsNotifications }: Props) {
  const parts = initialName.split(' ')
  const [firstName, setFirstName] = useState(parts[0] ?? '')
  const [lastName, setLastName] = useState(parts.slice(1).join(' '))
  const [email, setEmail] = useState(initialEmail)
  const [handicap, setHandicap] = useState(String(initialHandicap))
  const [phone, setPhone] = useState(initialPhone)
  const [smsNotifications, setSmsNotifications] = useState(initialSmsNotifications)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || '?'

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be under 5 MB' })
      return
    }

    setMessage(null)
    setSelectedFile(file)
  }

  async function handleCropConfirm(blob: Blob) {
    setSelectedFile(null)
    setUploading(true)

    const formData = new FormData()
    formData.append('file', blob, 'avatar.jpg')

    try {
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error ?? 'Upload failed' })
      } else {
        setAvatarUrl(json.avatarUrl)
        setMessage({ type: 'success', text: 'Profile photo updated' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Upload failed. Please try again.' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleCropCancel() {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">Edit Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar upload */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative group focus:outline-none"
            aria-label="Change profile photo"
          >
            <Avatar className="shrink" style={{ width: '100%', maxWidth: 480, height: 'auto', aspectRatio: '1 / 1' }}>
              {avatarUrl && <AvatarImage src={avatarUrl} alt={firstName} />}
              <AvatarFallback className="text-4xl">{initials}</AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
          </button>
          <span className="text-xs text-muted-foreground">
            {uploading ? 'Uploading…' : 'Click to change photo'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="sr-only"
            onChange={handleAvatarChange}
          />
        </div>

        <Separator />

        {/* Name & email form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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

      <AvatarCropDialog
        file={selectedFile}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </Card>
  )
}
