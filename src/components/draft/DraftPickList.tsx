'use client'

import { useState } from 'react'
import { SlugIcon } from './CardHand'

interface PickEffect {
  scoring: { mode: string; modifier: number | null }
  duration: number
  flavorText: string
  requiresTarget: boolean
}

interface Pick {
  pickNumber: number
  powerup: { name: string; type: 'BOOST' | 'ATTACK'; slug?: string; description?: string; effect?: PickEffect }
  tournamentPlayer: {
    id: string
    user: { name: string | null; image: string | null }
  }
}

interface Player {
  id: string
  user: { name: string | null; image: string | null }
}

interface DraftPickListProps {
  picks: Pick[]
  players?: Player[]
  picksPerPlayer?: number
}

function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : parts[0]
}

export function DraftPickList({ picks, players, picksPerPlayer = 3 }: DraftPickListProps) {
  const [selectedPick, setSelectedPick] = useState<Pick | null>(null)

  if (picks.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No picks yet. Waiting for draft to begin...
      </div>
    )
  }

  const playerIds = players
    ? players.map((p) => p.id)
    : [...new Set(picks.map((p) => p.tournamentPlayer.id))]

  const playerMap = new Map<string, { name: string; image: string | null }>()
  for (const pick of picks) {
    const tp = pick.tournamentPlayer
    if (!playerMap.has(tp.id)) {
      playerMap.set(tp.id, { name: tp.user.name ?? 'Player', image: tp.user.image })
    }
  }
  if (players) {
    for (const p of players) {
      if (!playerMap.has(p.id)) {
        playerMap.set(p.id, { name: p.user.name ?? 'Player', image: p.user.image })
      }
    }
  }

  const picksByPlayer = new Map<string, Pick[]>()
  for (const id of playerIds) {
    picksByPlayer.set(id, [])
  }
  for (const pick of picks) {
    const list = picksByPlayer.get(pick.tournamentPlayer.id)
    if (list) list.push(pick)
  }

  const roundCount = Math.max(picksPerPlayer, ...Array.from(picksByPlayer.values()).map((p) => p.length))

  // Calculate column widths as percentages so the table fills available width
  const playerPct = 22
  const pickPct = (100 - playerPct) / roundCount

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: `${playerPct}%` }} />
            {Array.from({ length: roundCount }, (_, i) => (
              <col key={i} style={{ width: `${pickPct}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-primary, #006747)' }}>
              <th className="px-1.5 sm:px-2 py-2 text-left text-[9px] sm:text-[11px] font-bold text-white uppercase tracking-wider">
                Player
              </th>
              {Array.from({ length: roundCount }, (_, i) => (
                <th
                  key={i}
                  className="px-0.5 py-2 text-center text-[9px] sm:text-[11px] font-bold text-white/70 uppercase tracking-wider"
                >
                  R{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {playerIds.map((playerId, rowIdx) => {
              const info = playerMap.get(playerId)
              const playerPicks = picksByPlayer.get(playerId) ?? []
              const lastName = getLastName(info?.name ?? 'Player')

              return (
                <tr key={playerId} className={rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                  <td
                    className={`px-1.5 sm:px-2 py-1 sm:py-1.5 border-r border-border ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                  >
                    <div className="flex items-center gap-1 sm:gap-1.5 overflow-hidden">
                      {info?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={info.image} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full shrink-0 object-cover" />
                      ) : (
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-primary, #006747)' }}>
                          <span className="text-[8px] sm:text-[9px] font-bold text-white">
                            {lastName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-[11px] font-semibold text-foreground truncate">
                        {lastName}
                      </span>
                    </div>
                  </td>

                  {Array.from({ length: roundCount }, (_, i) => {
                    const pick = playerPicks[i]

                    if (!pick) {
                      return (
                        <td key={i} className="px-0.5 py-1 sm:py-1.5">
                          <div className="h-10 sm:h-12 rounded-md sm:rounded-lg border border-dashed border-border/30 flex items-center justify-center">
                            <span className="text-[9px] text-muted-foreground/30">&mdash;</span>
                          </div>
                        </td>
                      )
                    }

                    const isAttack = pick.powerup.type === 'ATTACK'
                    const slug = pick.powerup.slug ?? ''

                    return (
                      <td key={i} className="px-0.5 py-1 sm:py-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPick(pick)}
                          className={`w-full h-10 sm:h-12 rounded-md sm:rounded-lg border-2 flex flex-col sm:flex-row items-center sm:gap-1 px-1 sm:px-1.5 justify-center sm:justify-start text-center sm:text-left cursor-pointer transition-opacity hover:opacity-80 active:opacity-60 overflow-hidden ${
                            isAttack
                              ? 'bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-700/60'
                              : 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700/60'
                          }`}
                        >
                          <SlugIcon slug={slug} isAttack={isAttack} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isAttack ? 'text-red-700' : 'text-emerald-800'}`} />
                          <span className={`text-[8px] sm:text-[11px] font-bold truncate max-w-full leading-tight ${
                            isAttack ? 'text-red-800 dark:text-red-200' : 'text-emerald-800 dark:text-emerald-200'
                          }`}>
                            {pick.powerup.name}
                          </span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Card-style detail overlay */}
      {selectedPick && (() => {
        const isAttack = selectedPick.powerup.type === 'ATTACK'
        const slug = selectedPick.powerup.slug ?? ''
        const effect = selectedPick.powerup.effect
        return (
          <>
            <div className="fixed inset-0 z-[90] bg-black/60" onClick={() => setSelectedPick(null)} />
            <div
              className="fixed z-[95]"
              style={{
                width: 'min(80vw, 300px)',
                height: 'min(calc(80vw * 1.45), 435px)',
                top: '55%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className={`absolute inset-0 rounded-2xl flex flex-col overflow-hidden select-none bg-[#f5f0e8] border-[3px] shadow-2xl shadow-black/50 ${
                isAttack ? 'border-red-700' : 'border-emerald-800'
              }`}>
                {/* Header */}
                <div className={`px-5 pt-5 pb-3 shrink-0 ${isAttack ? 'bg-red-800' : 'bg-emerald-900'}`}>
                  <div className="flex items-center gap-3">
                    <SlugIcon slug={slug} isAttack={isAttack} className="w-8 h-8 text-white" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">{selectedPick.powerup.type}</p>
                      <p className="text-xl font-heading font-bold text-white leading-tight">{selectedPick.powerup.name}</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 px-5 py-4 overflow-y-auto space-y-3">
                  {selectedPick.powerup.description && (
                    <p className="text-sm text-zinc-800 leading-relaxed">{selectedPick.powerup.description}</p>
                  )}
                  {effect && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        isAttack ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {effect.duration === -1 ? 'Variable' : `${effect.duration} Hole`}
                      </span>
                      {effect.scoring.modifier !== null && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          effect.scoring.modifier < 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {effect.scoring.modifier > 0 ? '+' : ''}{effect.scoring.modifier} strokes
                        </span>
                      )}
                      {effect.requiresTarget && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                          Targets opponent
                        </span>
                      )}
                    </div>
                  )}
                  {effect?.flavorText && (
                    <p className="text-xs italic text-zinc-500 border-t border-zinc-200 pt-2.5">
                      &ldquo;{effect.flavorText}&rdquo;
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 pt-1 border-t border-zinc-200">
                    Drafted by <span className="font-semibold text-zinc-700">{selectedPick.tournamentPlayer.user.name ?? 'Player'}</span>
                    {' '}&middot; Pick #{selectedPick.pickNumber}
                  </p>
                </div>

                {/* Footer */}
                <div className={`px-5 py-3 shrink-0 ${isAttack ? 'bg-red-800/10' : 'bg-emerald-900/10'}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedPick(null)}
                    className="w-full py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-zinc-200 transition-colors"
                  >
                    Tap to close
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      })()}
    </>
  )
}
