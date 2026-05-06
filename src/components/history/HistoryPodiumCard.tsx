import Image from 'next/image'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatVsPar } from '@/lib/scoring-utils'
import type { PastTournamentPodium, PodiumFinisher } from '@/lib/tournament-chain'

interface PlaceConfig {
  /** Tailwind h-* class for the podium block. 1st is tallest. */
  blockHeight: string
  /** Tailwind class for the medal-tier ring around the avatar. */
  ringClass: string
  /** Tailwind classes for the podium block fill. */
  blockClass: string
  /** Tailwind class for the rank number on the podium face. */
  rankNumberClass: string
  /** Tailwind class for avatar size. 1st is biggest. */
  avatarSize: string
  /** Pixel size matching avatarSize for next/image. */
  avatarPx: number
}

const PLACE: Record<1 | 2 | 3, PlaceConfig> = {
  1: {
    blockHeight: 'h-28',
    ringClass: 'ring-amber-400',
    blockClass: 'bg-gradient-to-b from-amber-300 to-amber-500',
    rankNumberClass: 'text-amber-900',
    avatarSize: 'h-16 w-16',
    avatarPx: 64,
  },
  2: {
    blockHeight: 'h-20',
    ringClass: 'ring-slate-300',
    blockClass: 'bg-gradient-to-b from-slate-200 to-slate-400',
    rankNumberClass: 'text-slate-700',
    avatarSize: 'h-12 w-12',
    avatarPx: 48,
  },
  3: {
    blockHeight: 'h-14',
    ringClass: 'ring-orange-400',
    blockClass: 'bg-gradient-to-b from-orange-300 to-orange-500',
    rankNumberClass: 'text-orange-900',
    avatarSize: 'h-12 w-12',
    avatarPx: 48,
  },
}

function PodiumColumn({ finisher }: { finisher: PodiumFinisher }) {
  const cfg = PLACE[finisher.rank as 1 | 2 | 3]
  if (!cfg) return null

  // Prefer net score when handicap system is in play, fallback to gross.
  const vsPar = finisher.netVsPar ?? finisher.grossVsPar
  const total = finisher.netTotal ?? finisher.grossTotal

  return (
    <div className="flex-1 flex flex-col items-center justify-end max-w-[120px] min-w-0">
      {/* Crown for 1st */}
      {finisher.rank === 1 && (
        <Trophy className="w-5 h-5 text-amber-500 mb-1" aria-hidden />
      )}

      {/* Avatar */}
      {finisher.avatarUrl ? (
        <Image
          src={finisher.avatarUrl}
          alt={finisher.playerName}
          width={cfg.avatarPx}
          height={cfg.avatarPx}
          className={`rounded-full object-cover ${cfg.avatarSize} ring-4 ${cfg.ringClass} ring-offset-2 ring-offset-card`}
          unoptimized
        />
      ) : (
        <div
          className={`${cfg.avatarSize} rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground ring-4 ${cfg.ringClass} ring-offset-2 ring-offset-card`}
        >
          {finisher.playerName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name + score, between avatar and block */}
      <div className="mt-2 mb-1 text-center min-w-0 w-full px-1">
        <p className="text-xs sm:text-sm font-semibold leading-tight truncate">
          {finisher.playerName}
        </p>
        <p className="text-[11px] sm:text-xs font-bold tabular-nums text-muted-foreground">
          {formatVsPar(vsPar)}
          {total !== null && (
            <span className="text-muted-foreground/70 font-normal"> · {total}</span>
          )}
        </p>
      </div>

      {/* Podium block */}
      <div
        className={`w-full rounded-t-md ${cfg.blockHeight} ${cfg.blockClass} flex items-start justify-center pt-1 shadow-sm`}
      >
        <span className={`text-3xl sm:text-4xl font-black ${cfg.rankNumberClass}`}>
          {finisher.rank}
        </span>
      </div>
    </div>
  )
}

export function HistoryPodiumCard({ podium }: { podium: PastTournamentPodium }) {
  // Olympic visual order: 2nd (left), 1st (center), 3rd (right).
  const byRank = new Map(podium.finishers.map((f) => [f.rank, f]))
  const ordered = [byRank.get(2), byRank.get(1), byRank.get(3)].filter(
    (f): f is PodiumFinisher => f !== undefined,
  )

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base truncate">
            {podium.year ? `${podium.year} — ${podium.name}` : podium.name}
          </CardTitle>
          <Link
            href={`/${podium.slug}/leaderboard`}
            className="text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            Full leaderboard →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No finishers recorded.</p>
        ) : (
          <div className="flex items-end justify-center gap-2 sm:gap-4 pt-4">
            {ordered.map((f) => (
              <PodiumColumn key={f.tournamentPlayerId} finisher={f} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
