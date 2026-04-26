'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CourseSearchCombobox } from './CourseSearchCombobox'
import type { RoundConfig } from '@/app/(main)/tournaments/new/actions'

type TeeOption = { id: string; name: string; color: string | null }

type SelectedCourse = {
  id: string
  name: string
  par: number
  teeOptions: TeeOption[]
}

type RoundState = RoundConfig & {
  course: SelectedCourse | null
  uniformTeeOptionId: string
}

interface Props {
  numRounds: number
  value: RoundState[]
  onChange: (v: RoundState[]) => void
  isOpenRegistration?: boolean
}

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

export function StepRounds({ numRounds, value, onChange, isOpenRegistration = false }: Props) {
  const [openRound, setOpenRound] = useState(0)

  function updateRound(index: number, updates: Partial<RoundState>) {
    const next = value.map((r, i) => (i === index ? { ...r, ...updates } : r))
    onChange(next)
  }

  function applyToAll(sourceIndex: number) {
    const source = value[sourceIndex]
    const next = value.map((r) => ({
      ...r,
      courseId: source.courseId,
      course: source.course,
      teeMode: source.teeMode,
      uniformTeeOptionId: source.uniformTeeOptionId,
      holeTees: source.holeTees,
    }))
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {value.slice(0, numRounds).map((round, i) => (
        <Card key={i} className={cn('overflow-visible', openRound === i ? 'ring-2 ring-primary/30' : '')}>
          <CardHeader
            className="pb-2 cursor-pointer select-none"
            onClick={() => setOpenRound(openRound === i ? -1 : i)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Round {round.roundNumber}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {round.course && <span className="text-foreground font-medium">{round.course.name}</span>}
                <span>{openRound === i ? '▲' : '▼'}</span>
              </div>
            </div>
          </CardHeader>

          {openRound === i && (
            <CardContent className="space-y-4 pt-0 overflow-visible">
              <div className="space-y-2">
                <Label>Round Date{isOpenRegistration ? ' (optional)' : ''}</Label>
                <Input
                  type="date"
                  value={round.date}
                  onChange={(e) => updateRound(i, { date: e.target.value })}
                />
                {isOpenRegistration && !round.date && (
                  <p className="text-xs text-muted-foreground">Open tournaments don&apos;t need specific round dates. Players can submit scores anytime before the tournament end date.</p>
                )}
              </div>

              <CourseSearchCombobox
                label="Course"
                selected={round.course}
                onSelect={(course) => {
                  if (!course) {
                    updateRound(i, { courseId: '', course: null, uniformTeeOptionId: '', holeTees: [] })
                    return
                  }
                  updateRound(i, {
                    courseId: course.id,
                    course,
                    uniformTeeOptionId: course.teeOptions[0]?.id ?? '',
                    holeTees: [],
                  })
                }}
              />

              {round.course && round.course.teeOptions.length > 0 && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Tee Selection Mode</Label>
                    <div className="flex gap-3">
                      {(['UNIFORM', 'CUSTOM'] as const).map((mode) => (
                        <label key={mode} className="flex items-center gap-1.5 cursor-pointer text-sm">
                          <input
                            type="radio"
                            name={`teeMode-${i}`}
                            value={mode}
                            checked={round.teeMode === mode}
                            onChange={() => updateRound(i, { teeMode: mode })}
                          />
                          {mode === 'UNIFORM' ? 'Same tee for all holes' : 'Custom (mix tees per hole)'}
                        </label>
                      ))}
                    </div>
                  </div>

                  {round.teeMode === 'UNIFORM' && (
                    <div className="space-y-2">
                      <Label>Tee Box</Label>
                      <select
                        value={round.uniformTeeOptionId}
                        onChange={(e) => updateRound(i, { uniformTeeOptionId: e.target.value })}
                        className="native-select flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        {round.course.teeOptions.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {round.teeMode === 'CUSTOM' && (
                    <div className="space-y-2">
                      <Label>Per-Hole Tee Selection</Label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {HOLES.map((holeNum) => {
                          const holeTee = round.holeTees.find((h) => h.holeNumber === holeNum)
                          return (
                            <div key={holeNum} className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground w-12">Hole {holeNum}</span>
                              <select
                                value={holeTee?.teeOptionId ?? round.course!.teeOptions[0]?.id ?? ''}
                                onChange={(e) => {
                                  const next = round.holeTees.filter((h) => h.holeNumber !== holeNum)
                                  next.push({ holeNumber: holeNum, teeOptionId: e.target.value })
                                  updateRound(i, { holeTees: next })
                                }}
                                className="native-select flex-1 h-7 rounded border border-input bg-transparent px-1 pr-6 text-xs"
                              >
                                {round.course!.teeOptions.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {numRounds > 1 && (
                <Button type="button" variant="outline" size="sm" onClick={() => applyToAll(i)}>
                  Apply this course &amp; tees to all rounds
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}

export function buildDefaultRounds(numRounds: number): RoundState[] {
  return Array.from({ length: numRounds }, (_, i) => ({
    roundNumber: i + 1,
    date: '',
    courseId: '',
    course: null,
    teeMode: 'UNIFORM' as const,
    uniformTeeOptionId: '',
    holeTees: [],
  }))
}

export type { RoundState }
