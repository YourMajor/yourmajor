'use client'

import { useState, useMemo } from 'react'
import { DateFilterTabs } from './DateFilterTabs'
import { LandingTournamentCard } from './LandingTournamentCard'

interface TournamentData {
  id: string
  slug: string
  name: string
  description: string | null
  logo: string | null
  status: string
  startDate: string | null
  endDate: string | null
  playerCount: number
}

interface TournamentCardGridProps {
  tournaments: TournamentData[]
  emptyMessage?: string
}

const IMAGE_VARIANTS = ['default', 'alt', 'gold'] as const

export function TournamentCardGrid({ tournaments, emptyMessage }: TournamentCardGridProps) {
  const [activeMonth, setActiveMonth] = useState('All')

  const availableMonths = useMemo(() => {
    const months = new Map<string, Date>()
    tournaments.forEach((t) => {
      if (t.startDate) {
        const d = new Date(t.startDate)
        const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        if (!months.has(label)) months.set(label, d)
      }
    })
    const sorted = [...months.entries()]
      .sort((a, b) => a[1].getTime() - b[1].getTime())
      .map(([label]) => label)
    return ['All', ...sorted]
  }, [tournaments])

  const filtered =
    activeMonth === 'All'
      ? tournaments
      : tournaments.filter((t) => {
          if (!t.startDate) return false
          const d = new Date(t.startDate)
          return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) === activeMonth
        })

  return (
    <div className="space-y-6">
      {availableMonths.length > 2 && (
        <DateFilterTabs
          availableMonths={availableMonths}
          activeMonth={activeMonth}
          onMonthChange={setActiveMonth}
        />
      )}

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((t, i) => (
            <LandingTournamentCard
              key={t.id}
              slug={t.slug}
              name={t.name}
              description={t.description}
              logo={t.logo}
              status={t.status}
              startDate={t.startDate}
              endDate={t.endDate}
              playerCount={t.playerCount}
              imageVariant={IMAGE_VARIANTS[i % 3]}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {emptyMessage ?? 'No tournaments found.'}
        </p>
      )}
    </div>
  )
}
