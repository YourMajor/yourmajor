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
    blockHeight: 'h-20',
    ringClass: 'ring-[#c9a96e]',
    blockClass: 'bg-gradient-to-b from-[#e8d5a3] to-[#c9a96e]',
    rankNumberClass: 'text-[#7a5e2a]',
    avatarSize: 'h-14 w-14',
    avatarPx: 56,
  },
  2: {
    blockHeight: 'h-14',
    ringClass: 'ring-zinc-300',
    blockClass: 'bg-gradient-to-b from-zinc-200 to-zinc-400',
    rankNumberClass: 'text-zinc-600',
    avatarSize: 'h-10 w-10',
    avatarPx: 40,
  },
  3: {
    blockHeight: 'h-10',
    ringClass: 'ring-orange-300/80',
    blockClass: 'bg-gradient-to-b from-orange-200 to-orange-400',
    rankNumberClass: 'text-orange-800',
    avatarSize: 'h-10 w-10',
    avatarPx: 40,
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
        <Trophy className="w-4 h-4 text-[#c9a96e] mb-1" aria-hidden />
      )}

      {/* Avatar */}
      {finisher.avatarUrl ? (
        <Image
          src={finisher.avatarUrl}
          alt={finisher.playerName}
          width={cfg.avatarPx}
          height={cfg.avatarPx}
          className={`rounded-full object-cover ${cfg.avatarSize} ring-2 ${cfg.ringClass} ring-offset-1 ring-offset-card`}
          unoptimized
        />
      ) : (
        <div
          className={`${cfg.avatarSize} rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground ring-2 ${cfg.ringClass} ring-offset-1 ring-offset-card`}
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
        <span className={`text-xl sm:text-2xl font-black ${cfg.rankNumberClass}`}>
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
          <div className="flex items-end justify-center gap-2 sm:gap-3 pt-2">
            {ordered.map((f) => (
              <PodiumColumn key={f.tournamentPlayerId} finisher={f} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
