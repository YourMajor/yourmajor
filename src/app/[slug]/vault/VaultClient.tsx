'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

interface Standing {
  rank: number
  playerName: string
  avatarUrl: string | null
  handicap: number
  holesPlayed: number
  grossTotal: number | null
  netTotal: number | null
  grossVsPar: number | null
  netVsPar: number | null
}

interface VaultEntry {
  tournamentId: string
  name: string
  year: number
  championName: string | null
  standings: Standing[]
}

interface Props {
  entries: VaultEntry[]
}

function formatVsPar(n: number | null): string {
  if (n === null) return '—'
  if (n === 0) return 'E'
  return n > 0 ? `+${n}` : `${n}`
}

export function VaultClient({ entries }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selected = entries[selectedIndex]

  if (!selected) return null

  return (
    <div className="space-y-6">
      {/* Year selector tabs */}
      <div className="flex gap-2 flex-wrap">
        {entries.map((entry, i) => (
          <button
            key={entry.tournamentId}
            onClick={() => setSelectedIndex(i)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              i === selectedIndex
                ? 'text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            style={i === selectedIndex ? { backgroundColor: 'var(--color-primary)' } : {}}
          >
            {entry.name}{entry.year ? ` (${entry.year})` : ''}
          </button>
        ))}
      </div>

      {/* Champion highlight */}
      {selected.championName && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Trophy className="w-5 h-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Champion</p>
              <p className="font-heading font-bold text-lg">{selected.championName}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Final leaderboard table */}
      {selected.standings.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-2.5 px-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground w-12">Pos</th>
                <th className="text-left py-2.5 px-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Player</th>
                <th className="text-center py-2.5 px-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Gross</th>
                <th className="text-center py-2.5 px-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Net</th>
                <th className="text-center py-2.5 px-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden sm:table-cell">HCP</th>
                <th className="text-center py-2.5 px-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Thru</th>
              </tr>
            </thead>
            <tbody>
              {selected.standings.map((s, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="py-2.5 px-3 font-semibold text-muted-foreground">{s.rank}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        {s.avatarUrl && <AvatarImage src={s.avatarUrl} />}
                        <AvatarFallback className="text-[10px]">
                          {s.playerName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate">{s.playerName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold">{formatVsPar(s.grossVsPar)}</td>
                  <td className="py-2.5 px-3 text-center">{formatVsPar(s.netVsPar)}</td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground hidden sm:table-cell">{s.handicap}</td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground hidden sm:table-cell">{s.holesPlayed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No scores recorded for this tournament.</p>
      )}
    </div>
  )
}
