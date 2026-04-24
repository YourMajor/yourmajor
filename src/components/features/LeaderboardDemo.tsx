'use client'

import { useState, useEffect, useRef } from 'react'
import { Crown } from 'lucide-react'

const INITIAL = [
  { name: 'M. Johnson', initial: 'M', score: -3, thru: 14, isChamp: true },
  { name: 'T. Williams', initial: 'T', score: -2, thru: 15 },
  { name: 'R. Garcia', initial: 'R', score: -2, thru: 13 },
  { name: 'K. Chen', initial: 'K', score: -1, thru: 16 },
  { name: 'J. Smith', initial: 'J', score: 0, thru: 14 },
]

// [playerIndex, newScore, newThru]
const UPDATES: [number, number, number][] = [
  [2, -4, 14],
  [4, -2, 15],
  [0, -5, 15],
  [3, -3, 17],
  [1, -4, 16],
]

function vsParLabel(n: number) {
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : `${n}`
}

export function LeaderboardDemo() {
  const [players, setPlayers] = useState(INITIAL)
  const [flash, setFlash] = useState<number | null>(null)
  const step = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => {
      if (step.current >= UPDATES.length) {
        setPlayers(INITIAL)
        setFlash(null)
        step.current = 0
        return
      }
      const [idx, newScore, newThru] = UPDATES[step.current]
      setPlayers((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, score: newScore, thru: newThru } : p))
      )
      setFlash(idx)
      step.current++
    }, 2200)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (flash === null) return
    const t = setTimeout(() => setFlash(null), 900)
    return () => clearTimeout(t)
  }, [flash])

  const sorted = players
    .map((p, i) => ({ ...p, oi: i }))
    .sort((a, b) => a.score - b.score)

  // Compute display ranks with ties
  const ranks: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].score === sorted[i - 1].score) {
      ranks.push(ranks[i - 1]) // same rank
    } else {
      ranks.push(i > 0 && sorted[i].score === sorted[i - 1].score ? ranks[i - 1] : `${i + 1}`)
    }
  }
  // Add T prefix for ties
  const displayRanks = ranks.map((r) => {
    const count = ranks.filter((x) => x === r).length
    return count > 1 ? `T${r}` : r
  })

  return (
    <div className="rounded-xl overflow-hidden shadow-lg max-w-sm lg:max-w-md mx-auto md:mx-0 border border-border">
      {/* Live indicator bar */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <span className="text-white font-heading font-semibold text-sm lg:text-base">Leaderboard</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-white font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </span>
      </div>

      {/* Masters-style table */}
      <table className="masters-table">
        <thead>
          <tr>
            <th style={{ width: '36px' }} className="px-0">POS</th>
            <th className="text-left pl-3">PLAYER</th>
            <th style={{ width: '18%' }}>TOTAL</th>
            <th style={{ width: '15%' }}>THRU</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr
              key={p.name}
              className={`transition-colors duration-500 ${
                flash === p.oi ? '!bg-emerald-50' : ''
              }`}
            >
              {/* Rank */}
              <td className="text-center px-0" style={{ width: '36px' }}>
                <span className="text-sm font-bold">
                  {displayRanks[i].startsWith('T') ? (
                    <>
                      <span className="text-muted-foreground text-xs">T</span>
                      {displayRanks[i].slice(1)}
                    </>
                  ) : (
                    displayRanks[i]
                  )}
                </span>
              </td>

              {/* Player with avatar */}
              <td className="pl-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    {p.isChamp ? (
                      <div className="rounded-full p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-white"
                          style={{ backgroundColor: 'var(--primary)' }}
                        >
                          {p.initial}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        {p.initial}
                      </div>
                    )}
                    {p.isChamp && (
                      <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 text-yellow-900 ring-2 ring-white">
                        <Crown className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium truncate">{p.name}</span>
                </div>
              </td>

              {/* Score */}
              <td className="text-center">
                <span className={`text-sm font-extrabold ${
                  p.score < 0 ? 'text-red-600' : 'text-foreground'
                }`}>
                  {vsParLabel(p.score)}
                </span>
              </td>

              {/* Thru */}
              <td className="text-center">
                <span className="text-sm text-muted-foreground">{p.thru}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
