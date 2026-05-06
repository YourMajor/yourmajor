import Image from 'next/image'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatVsPar } from '@/lib/scoring-utils'
import type { PastTournamentPodium, PodiumFinisher } from '@/lib/tournament-chain'

const RANK_LABELS = ['1st', '2nd', '3rd']
const RANK_RING = [
  'ring-amber-400',
  'ring-slate-300',
  'ring-orange-400',
]

function FinisherRow({ finisher, slug }: { finisher: PodiumFinisher; slug: string }) {
  const ring = RANK_RING[finisher.rank - 1] ?? 'ring-border'
  const label = RANK_LABELS[finisher.rank - 1] ?? `${finisher.rank}th`

  // Prefer net score when available (handicap system in play), fallback to gross.
  const vsPar = finisher.netVsPar ?? finisher.grossVsPar
  const total = finisher.netTotal ?? finisher.grossTotal

  return (
    <li className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
      <span className="w-10 shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {finisher.rank === 1 ? (
          <Trophy className="w-4 h-4 text-amber-500" />
        ) : (
          label
        )}
      </span>

      {finisher.avatarUrl ? (
        <Image
          src={finisher.avatarUrl}
          alt={finisher.playerName}
          width={32}
          height={32}
          className={`rounded-full object-cover h-8 w-8 ring-2 ${ring}`}
          unoptimized
        />
      ) : (
        <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium ring-2 ${ring}`}>
          {finisher.playerName.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{finisher.playerName}</p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums">{formatVsPar(vsPar)}</p>
        {total !== null && (
          <p className="text-[11px] text-muted-foreground tabular-nums">{total}</p>
        )}
      </div>

      <Link
        href={`/${slug}/leaderboard`}
        className="text-[11px] text-muted-foreground hover:text-foreground hidden sm:inline"
      >
        View →
      </Link>
    </li>
  )
}

export function HistoryPodiumCard({ podium }: { podium: PastTournamentPodium }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">
              {podium.year ? `${podium.year} — ${podium.name}` : podium.name}
            </CardTitle>
            <CardDescription>Top finishers</CardDescription>
          </div>
          <Link
            href={`/${podium.slug}/leaderboard`}
            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            Full leaderboard →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {podium.finishers.map((f) => (
            <FinisherRow key={f.tournamentPlayerId} finisher={f} slug={podium.slug} />
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
