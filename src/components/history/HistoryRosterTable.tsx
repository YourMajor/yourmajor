import Image from 'next/image'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import type { RosterEntry } from '@/lib/tournament-chain'

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function RosterRow({ entry, totalYears }: { entry: RosterEntry; totalYears: number }) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
      {entry.avatarUrl ? (
        <Image
          src={entry.avatarUrl}
          alt={entry.playerName}
          width={32}
          height={32}
          className="rounded-full object-cover h-8 w-8"
          unoptimized
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
          {entry.playerName.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.playerName}</p>
        <p className="text-[11px] text-muted-foreground">
          {entry.yearsPlayed} of {totalYears} year{totalYears === 1 ? '' : 's'}
        </p>
      </div>

      {entry.bestFinish && (
        <Link
          href={`/${entry.bestFinish.slug}/leaderboard`}
          className="text-right shrink-0 hover:text-foreground text-muted-foreground"
        >
          <p className="text-xs flex items-center justify-end gap-1">
            {entry.bestFinish.rank === 1 && (
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="font-semibold tabular-nums">
              Best: {ordinal(entry.bestFinish.rank)}
            </span>
          </p>
          {entry.bestFinish.year && (
            <p className="text-[11px] tabular-nums">in {entry.bestFinish.year}</p>
          )}
        </Link>
      )}
    </li>
  )
}

export function HistoryRosterTable({
  entries,
  totalYears,
}: {
  entries: RosterEntry[]
  totalYears: number
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No registered players have completed an edition yet.
      </p>
    )
  }

  return (
    <ol className="space-y-2">
      {entries.map((e) => (
        <RosterRow key={e.userId} entry={e} totalYears={totalYears} />
      ))}
    </ol>
  )
}
