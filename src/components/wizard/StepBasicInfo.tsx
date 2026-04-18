'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorDonutPicker } from '@/components/ui/color-donut-picker'

export type BasicInfoState = {
  name: string
  description: string
  startDate: string
  endDate: string
  numRounds: number
  logoPreview: string | null
  logoBase64: string | null
  logoMime: string | null
  logoExt: string | null
  headerPreview: string | null
  headerBase64: string | null
  headerMime: string | null
  headerExt: string | null
  primaryColor: string
  accentColor: string
}

interface Props {
  value: BasicInfoState
  onChange: (v: BasicInfoState) => void
}

const MAX_LOGO_MB = 10

export function StepBasicInfo({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const headerFileRef = useRef<HTMLInputElement>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [headerError, setHeaderError] = useState<string | null>(null)

  function set<K extends keyof BasicInfoState>(key: K, val: BasicInfoState[K]) {
    onChange({ ...value, [key]: val })
  }

  function handleLogo(file: File | null) {
    setLogoError(null)
    if (!file) {
      onChange({ ...value, logoPreview: null, logoBase64: null, logoMime: null, logoExt: null })
      return
    }
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      setLogoError(`Logo must be under ${MAX_LOGO_MB} MB.`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const ext = file.name.split('.').pop() ?? 'png'
    const mime = file.type
    const reader = new FileReader()
    reader.onload = (e) => {
      onChange({ ...value, logoPreview: e.target?.result as string, logoBase64: e.target?.result as string, logoMime: mime, logoExt: ext })
    }
    reader.readAsDataURL(file)
  }

  function handleHeaderImage(file: File | null) {
    setHeaderError(null)
    if (!file) {
      onChange({ ...value, headerPreview: null, headerBase64: null, headerMime: null, headerExt: null })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setHeaderError('Header image must be under 10 MB.')
      if (headerFileRef.current) headerFileRef.current.value = ''
      return
    }
    const ext = file.name.split('.').pop() ?? 'jpg'
    const mime = file.type
    const reader = new FileReader()
    reader.onload = (e) => {
      onChange({ ...value, headerPreview: e.target?.result as string, headerBase64: e.target?.result as string, headerMime: mime, headerExt: ext })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tournament Name *</Label>
            <Input
              id="name"
              value={value.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. The Masters Weekend"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <textarea
              id="description"
              value={value.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Tell players what this tournament is about..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={value.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={value.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numRounds">Number of Rounds</Label>
            <select
              id="numRounds"
              value={value.numRounds}
              onChange={(e) => set('numRounds', parseInt(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n} Round{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo <span className="text-muted-foreground font-normal">(optional)</span></Label>
            {value.logoPreview && (
              <Image src={value.logoPreview} alt="Logo preview" width={48} height={48} className="h-12 object-contain mb-1" />
            )}
            <Input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleLogo(e.target.files?.[0] ?? null)}
            />
            {logoError
              ? <p className="text-xs text-destructive">{logoError}</p>
              : <p className="text-xs text-muted-foreground">PNG, JPG, or SVG · Max {MAX_LOGO_MB} MB</p>
            }
          </div>

          <div className="space-y-2">
            <Label>Header Image <span className="text-muted-foreground font-normal">(optional — displays edge-to-edge)</span></Label>
            {value.headerPreview && (
              <Image src={value.headerPreview} alt="Header preview" width={800} height={96} className="w-full h-24 object-cover rounded-md mb-1" />
            )}
            <Input
              ref={headerFileRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleHeaderImage(e.target.files?.[0] ?? null)}
            />
            {headerError
              ? <p className="text-xs text-destructive">{headerError}</p>
              : <p className="text-xs text-muted-foreground">Wide landscape image recommended · Max 10 MB</p>
            }
          </div>

          <ColorDonutPicker
            primaryColor={value.primaryColor}
            accentColor={value.accentColor}
            onPrimaryChange={(c) => set('primaryColor', c)}
            onAccentChange={(c) => set('accentColor', c)}
            onPairChange={(primary, accent) => onChange({ ...value, primaryColor: primary, accentColor: accent })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
