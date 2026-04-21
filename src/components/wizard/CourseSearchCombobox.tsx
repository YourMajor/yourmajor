'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { CourseSearchResult } from '@/app/api/courses/search/route'

type TeeOption = { id: string; name: string; color: string | null }

type SelectedCourse = {
  id: string
  name: string
  par: number
  teeOptions: TeeOption[]
}

interface Props {
  label?: string
  onSelect: (course: SelectedCourse) => void
  selected: SelectedCourse | null
}

export function CourseSearchCombobox({ label = 'Course', onSelect, selected }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CourseSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customHoles, setCustomHoles] = useState('18')
  const [customHolePars, setCustomHolePars] = useState<number[]>(Array(18).fill(4))
  const [customTeeName, setCustomTeeName] = useState('White')
  const [customHoleYardages, setCustomHoleYardages] = useState<number[]>(Array(18).fill(350))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const holeCount = parseInt(customHoles)
  const computedPar = customHolePars.slice(0, holeCount).reduce((a, b) => a + b, 0)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/courses/search?q=${encodeURIComponent(query)}`)
        if (res.ok) setResults(await res.json())
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  async function handleSelect(result: CourseSearchResult) {
    setOpen(false)
    setQuery('')
    setResults([])

    if (result.source === 'local') {
      // Fetch tee options for local course
      const res = await fetch(`/api/courses/${result.id}`)
      if (res.ok) {
        const course = await res.json()
        onSelect({ id: course.id, name: course.name, par: course.par, teeOptions: course.teeOptions ?? [] })
      } else {
        onSelect({ id: result.id, name: result.name, par: result.par, teeOptions: [] })
      }
      return
    }

    // Import from GolfCourseAPI
    const res = await fetch('/api/courses/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ golfApiCourseId: result.golfApiCourseId }),
    })
    if (res.ok) {
      const course = await res.json()
      onSelect({ id: course.id, name: course.name, par: course.par, teeOptions: course.teeOptions ?? [] })
    }
  }

  function updateHolePar(index: number, value: number) {
    setCustomHolePars(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function updateHoleYardage(index: number, value: number) {
    setCustomHoleYardages(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  async function handleCreateCustom() {
    if (!customName.trim()) return
    const holePars = customHolePars.slice(0, holeCount)
    const holeYardages = customHoleYardages.slice(0, holeCount)

    const res = await fetch('/api/courses/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customName.trim(),
        par: computedPar,
        holes: holeCount,
        holePars,
        teeName: customTeeName.trim() || 'White',
        holeYardages,
      }),
    })
    if (res.ok) {
      const course = await res.json()
      onSelect({ id: course.id, name: course.name, par: course.par, teeOptions: course.teeOptions ?? [] })
      setShowCustomForm(false)
      setCustomName('')
      setCustomHolePars(Array(18).fill(4))
      setCustomTeeName('White')
      setCustomHoleYardages(Array(18).fill(350))
    }
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selected.name}</p>
          <p className="text-xs text-muted-foreground">Par {selected.par} · {selected.teeOptions.length} tee option{selected.teeOptions.length !== 1 ? 's' : ''}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null as unknown as SelectedCourse)}>
          Change
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          placeholder="Search by course name..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && (results.length > 0 || loading) && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {loading && <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between gap-2"
                onMouseDown={() => handleSelect(r)}
              >
                <span>
                  <span className="font-medium">{r.name}</span>
                  {r.location && <span className="text-muted-foreground ml-1 text-xs">— {r.location}</span>}
                </span>
                <Badge variant={r.source === 'local' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                  {r.source === 'local' ? 'saved' : 'API'}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {!showCustomForm ? (
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setShowCustomForm(true)}
        >
          Can&apos;t find your course? Add custom course
        </button>
      ) : (
        <div className="space-y-3 p-3 rounded-md border border-dashed border-border bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">Custom Course</p>
          <Input
            placeholder="Course name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="text-sm"
          />
          <div className="flex items-center gap-4">
            <div>
              <Label className="text-xs">Holes</Label>
              <select
                value={customHoles}
                onChange={(e) => setCustomHoles(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="9">9</option>
                <option value="18">18</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Total Par</Label>
              <p className="h-9 flex items-center text-sm font-medium">{computedPar}</p>
            </div>
          </div>

          {/* Per-hole par */}
          <div className="space-y-1.5">
            <Label className="text-xs">Par per Hole</Label>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
              {Array.from({ length: holeCount }, (_, i) => (
                <div key={i} className="text-center">
                  <span className="text-[11px] text-muted-foreground">{i + 1}</span>
                  <Input
                    type="number"
                    min={3}
                    max={6}
                    value={customHolePars[i]}
                    onChange={(e) => updateHolePar(i, parseInt(e.target.value) || 4)}
                    className="h-8 px-1 text-center text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Tee name + per-hole yardage */}
          <div className="space-y-1.5">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-xs">Tee Name</Label>
                <Input
                  placeholder="e.g. White"
                  value={customTeeName}
                  onChange={(e) => setCustomTeeName(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Yardage per Hole</Label>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
              {Array.from({ length: holeCount }, (_, i) => (
                <div key={i} className="text-center">
                  <span className="text-[11px] text-muted-foreground">{i + 1}</span>
                  <Input
                    type="number"
                    min={50}
                    max={700}
                    value={customHoleYardages[i]}
                    onChange={(e) => updateHoleYardage(i, parseInt(e.target.value) || 350)}
                    className="h-8 px-1 text-center text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" onClick={handleCreateCustom}>Add Course</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowCustomForm(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
