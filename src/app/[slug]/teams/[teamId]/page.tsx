export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Crown } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getLeaderboard } from '@/lib/scoring'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>
}) {
  const { slug, teamId } = await params

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      tournamentFormat: true,
      rounds: {
        orderBy: { roundNumber: 'asc' },
        select: {
          id: true,
          roundNumber: true,
          course: { select: { holes: { select: { number: true, par: true } } } },
        },
      },
    },
  })
  if (!tournament) notFound()

  const team = await prisma.tournamentTeam.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      tournamentId: true,
      name: true,
      color: true,
      members: {
        select: {
          isCaptain: true,
          tournamentPlayer: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  email: true,
                  image: true,
                  profile: { select: { avatar: true } },
                },
              },
              scores: {
                select: {
                  strokes: true,
                  hole: { select: { number: true, par: true } },
                  round: { select: { roundNumber: true } },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!team || team.tournamentId !== tournament.id) notFound()

  const standings = await getLeaderboard(tournament.id)
  const standing = standings.find((s) => s.teamId === team.id)

  const isBestBall =
    tournament.tournamentFormat === 'BEST_BALL'
    || tournament.tournamentFormat === 'BEST_BALL_2'
    || tournament.tournamentFormat === 'BEST_BALL_4'

  const roundNumbers = tournament.rounds.map((r) => r.roundNumber)
  const courseHoles = tournament.rounds[0]?.course.holes ?? []

  // Per-hole best-ball contribution: for each (round, hole), find the member with
  // the lowest score and the value of that score. Used to render the contribution grid.
  type ContribCell = { winnerPlayerId: string | null; strokes: number | null; par: number }
  const contribGrid: Record<number, Record<number, ContribCell>> = {}
  if (isBestBall) {
    for (const round of tournament.rounds) {
      contribGrid[round.roundNumber] = {}
      for (const h of courseHoles) {
        let best: { playerId: string; strokes: number } | null = null
        for (const m of team.members) {
          const s = m.tournamentPlayer.scores.find(
            (sc) => sc.round.roundNumber === round.roundNumber && sc.hole.number === h.number,
          )
          if (!s) continue
          if (!best || s.strokes < best.strokes) {
            best = { playerId: m.tournamentPlayer.id, strokes: s.strokes }
          }
        }
        contribGrid[round.roundNumber][h.number] = {
          winnerPlayerId: best?.playerId ?? null,
          strokes: best?.strokes ?? null,
          par: h.par,
        }
      }
    }
  }

  const members = team.members.map((m) => ({
    id: m.tournamentPlayer.id,
    name: m.tournamentPlayer.user.name ?? m.tournamentPlayer.user.email.split('@')[0],
    avatarUrl: m.tournamentPlayer.user.profile?.avatar ?? m.tournamentPlayer.user.image ?? null,
    isCaptain: m.isCaptain,
  }))

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Link
        href={`/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {tournament.name}
      </Link>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 mb-6">
        <span
          className="inline-block h-6 w-6 rounded-full ring-1 ring-border"
          style={{ backgroundColor: team.color ?? 'var(--color-primary, oklch(0.40 0.11 160))' }}
          aria-hidden="true"
        />
        <div>
          <h1 className="text-2xl font-heading font-bold">{team.name}</h1>
          {standing && (
            <p className="text-sm text-muted-foreground">
              Rank {standing.rank} · {standing.holesPlayed} holes played
              {standing.grossVsPar !== null && (
                <> · {standing.grossVsPar === 0 ? 'E' : standing.grossVsPar > 0 ? `+${standing.grossVsPar}` : standing.grossVsPar}</>
              )}
            </p>
          )}
        </div>
      </header>

      {/* ── Roster ─────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Roster</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={m.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-sm font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                    {m.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {m.isCaptain && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-400 text-yellow-900 ring-1 ring-background">
                    <Crown className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                {m.isCaptain && (
                  <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">Captain</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Per-round totals ───────────────────────────────────────────── */}
      {standing && roundNumbers.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Round Totals
          </h2>
          <div className="rounded-lg overflow-hidden overflow-x-auto">
            <table className="masters-table">
              <thead>
                <tr>
                  {roundNumbers.map((r) => (
                    <th key={r} className="text-center">R{r}</th>
                  ))}
                  <th className="text-center">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {roundNumbers.map((r) => (
                    <td key={r} className="text-center text-sm">
                      {standing.roundTotals[r] ?? '—'}
                    </td>
                  ))}
                  <td className="text-center text-sm font-bold">{standing.grossTotal ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Best-ball contribution grid ────────────────────────────────── */}
      {isBestBall && courseHoles.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Member Contributions (lowest score per hole)
          </h2>
          <div className="rounded-lg overflow-hidden overflow-x-auto">
            <table className="masters-table">
              <thead>
                <tr>
                  <th className="text-left pl-3">ROUND</th>
                  {courseHoles.map((h) => (
                    <th key={h.number} className="text-center">{h.number}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tournament.rounds.map((r) => (
                  <tr key={r.id}>
                    <td className="text-left pl-3 text-sm font-semibold">R{r.roundNumber}</td>
                    {courseHoles.map((h) => {
                      const cell = contribGrid[r.roundNumber]?.[h.number]
                      const winner = cell?.winnerPlayerId
                        ? members.find((m) => m.id === cell.winnerPlayerId)
                        : null
                      return (
                        <td key={h.number} className="text-center text-xs">
                          {cell?.strokes !== null && cell?.strokes !== undefined ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-semibold">{cell.strokes}</span>
                              {winner && (
                                <span
                                  title={winner.name}
                                  className="text-[10px] text-muted-foreground truncate max-w-[3em]"
                                >
                                  {winner.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}
