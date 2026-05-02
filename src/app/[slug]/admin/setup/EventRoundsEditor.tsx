'use client'

import { useState, useTransition } from 'react'
import { CourseSearchCombobox } from '@/components/wizard/CourseSearchCombobox'
import { setEventRoundCourse } from './round-actions'

type TeeOption = { id: string; name: string; color: string | null }

type SelectedCourse = {
  id: string
  name: string
  par: number
  teeOptions: TeeOption[]
}

export interface EventRound {
  id: string
  roundNumber: number
  course: SelectedCourse | null
}

interface Props {
  rounds: EventRound[]
  scoresLocked: boolean
}

export function EventRoundsEditor({ rounds, scoresLocked }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorByRound, setErrorByRound] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()
  const [localCourse, setLocalCourse] = useState<Record<string, SelectedCourse | null>>(() =>
    Object.fromEntries(rounds.map((r) => [r.id, r.course])),
  )

  function handleSelect(roundId: string, course: SelectedCourse | null) {
    setLocalCourse((prev) => ({ ...prev, [roundId]: course }))
    if (!course) return // "Change" pressed — wait for a real selection
    setErrorByRound((prev) => ({ ...prev, [roundId]: '' }))
    setPendingId(roundId)
    startTransition(async () => {
      const result = await setEventRoundCourse({ roundId, courseId: course.id })
      setPendingId(null)
      if (!result.ok) {
        setErrorByRound((prev) => ({ ...prev, [roundId]: result.error }))
      }
    })
  }

  if (rounds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No rounds attached to this event. Recreate the event from the season schedule to add rounds.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {scoresLocked && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Scores have been recorded for one or more rounds. Course can&apos;t be changed for those rounds.
        </div>
      )}
      {rounds.map((round) => {
        const selected = localCourse[round.id]
        const isPending = pendingId === round.id
        const error = errorByRound[round.id]
        return (
          <div key={round.id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-sm font-medium">
                Round {round.roundNumber}
              </h4>
              {isPending && <span className="text-xs text-muted-foreground">Saving…</span>}
            </div>
            <CourseSearchCombobox
              label=""
              selected={selected}
              onSelect={(c) => handleSelect(round.id, c)}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )
      })}
    </div>
  )
}
