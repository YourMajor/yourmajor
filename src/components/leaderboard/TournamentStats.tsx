'use client'

import { type PlayerStanding } from '@/lib/scoring-utils'
import { Trophy, Target, Flame, TrendingDown, Swords, Award } from 'lucide-react'

interface AttackStat {
  playerName: string
  count: number
}

interface Props {
  standings: PlayerStanding[]
  roundNumbers: number[]
  powerupsEnabled: boolean
  attackStats?: AttackStat[]
}

interface Superlative {
  icon: React.ComponentType<{ className?: string }>
  label: string
  playerName: string
  value: string
}

export function TournamentStats({ standings, roundNumbers, powerupsEnabled, attackStats }: Props) {
  const playersWithScores = standings.filter((s) => s.holesPlayed > 0)
  if (playersWithScores.length === 0) return null

  const superlatives: Superlative[] = []

  // Best Score (lowest gross vs par)
  const bestGross = [...playersWithScores]
    .filter((s) => s.grossVsPar !== null)
    .sort((a, b) => a.grossVsPar! - b.grossVsPar!)
  if (bestGross.length > 0) {
    const p = bestGross[0]
    const val = p.grossVsPar!
    superlatives.push({
      icon: Trophy,
      label: 'Best Score',
      playerName: p.playerName,
      value: val === 0 ? 'E' : val > 0 ? `+${val}` : `${val}`,
    })
  }

  // Best Round (lowest single-round stroke total, only from completed rounds)
  let bestRound: { playerName: string; round: number; total: number } | null = null
  for (const p of playersWithScores) {
    for (const rn of roundNumbers) {
      const total = p.roundTotals[rn]
      // Only count if the player completed at least 18 holes in/through this round
      const holesNeeded = rn * 18
      if (total !== undefined && p.holesPlayed >= holesNeeded && (!bestRound || total < bestRound.total)) {
        bestRound = { playerName: p.playerName, round: rn, total }
      }
    }
  }
  if (bestRound) {
    superlatives.push({
      icon: Award,
      label: `Best Round${roundNumbers.length > 1 ? ` (R${bestRound.round})` : ''}`,
      playerName: bestRound.playerName,
      value: `${bestRound.total}`,
    })
  }

  // Most Birdies
  const birdyCounts = playersWithScores.map((p) => ({
    playerName: p.playerName,
    count: p.holes.filter((h) => h.diff === -1).length,
  })).sort((a, b) => b.count - a.count)
  if (birdyCounts.length > 0 && birdyCounts[0].count > 0) {
    superlatives.push({
      icon: Target,
      label: 'Most Birdies',
      playerName: birdyCounts[0].playerName,
      value: `${birdyCounts[0].count}`,
    })
  }

  // Most Eagles (or better)
  const eagleCounts = playersWithScores.map((p) => ({
    playerName: p.playerName,
    count: p.holes.filter((h) => h.diff !== null && h.diff <= -2).length,
  })).sort((a, b) => b.count - a.count)
  if (eagleCounts.length > 0 && eagleCounts[0].count > 0) {
    superlatives.push({
      icon: Flame,
      label: 'Most Eagles',
      playerName: eagleCounts[0].playerName,
      value: `${eagleCounts[0].count}`,
    })
  }

  // Fewest Bogeys (among players who played a meaningful number of holes)
  const bogeyFreePlayers = playersWithScores
    .filter((p) => p.holesPlayed >= 9)
    .map((p) => ({
      playerName: p.playerName,
      count: p.holes.filter((h) => h.diff !== null && h.diff >= 1).length,
    }))
    .sort((a, b) => a.count - b.count)
  if (bogeyFreePlayers.length > 0) {
    superlatives.push({
      icon: TrendingDown,
      label: 'Fewest Bogeys',
      playerName: bogeyFreePlayers[0].playerName,
      value: `${bogeyFreePlayers[0].count}`,
    })
  }

  // Most Attacked (powerups)
  if (powerupsEnabled && attackStats && attackStats.length > 0) {
    const mostAttacked = [...attackStats].sort((a, b) => b.count - a.count)[0]
    if (mostAttacked.count > 0) {
      superlatives.push({
        icon: Swords,
        label: 'Most Attacked',
        playerName: mostAttacked.playerName,
        value: `${mostAttacked.count} hit${mostAttacked.count !== 1 ? 's' : ''}`,
      })
    }
  }

  if (superlatives.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="text-xl sm:text-2xl font-heading font-bold mb-5">
        Tournament Superlatives
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {superlatives.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-3"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">
                  {s.label}
                </p>
                <p className="text-sm font-medium text-foreground truncate">{s.playerName}</p>
                <p className="text-base font-heading font-bold leading-tight" style={{ color: 'var(--color-primary)' }}>
                  {s.value}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
