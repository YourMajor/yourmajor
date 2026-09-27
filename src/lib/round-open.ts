import { prisma } from './prisma'

/** Rounds open this long before the first tee time unless launched sooner. */
export const AUTO_OPEN_LEAD_MS = 3 * 60 * 60 * 1000

/** Used when a tournament has tee times but no recorded time zone. */
export const FALLBACK_TIME_ZONE = 'America/Toronto'

export type RoundOpenReason =
  | 'first-round' // Round 1 opens with the tournament itself (Go Live)
  | 'launched' // an admin launched it
  | 'started' // someone already has scores in it
  | 'auto' // within 3 hours of the first tee time
  | 'scheduled' // closed; opensAt says when
  | 'needs-launch' // closed; no date or tee time to open it automatically

export interface RoundOpenState {
  open: boolean
  reason: RoundOpenReason
  /** When the round opens (or opened) automatically, if that can be worked out. */
  opensAt: Date | null
}

/** Offset of `timeZone` from UTC at `instant`, in ms (e.g. -4h for EDT). */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - instant
}

/**
 * The instant a wall-clock time happens in a time zone, without a tz library.
 * Two passes so a DST change between the guess and the answer settles.
 */
export function zonedWallClockToUtc(
  y: number,
  monthIndex: number,
  d: number,
  h: number,
  min: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(y, monthIndex, d, h, min)
  let utc = wall - zoneOffsetMs(wall, timeZone)
  utc = wall - zoneOffsetMs(utc, timeZone)
  return new Date(utc)
}

function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * First tee time of a round as a real instant.
 *
 * Tee times are set per group for the whole tournament and stored as
 * wall-clock hours in the UTC fields (see updateGroupTeeTime), and a round's
 * date is a calendar day stored at UTC midnight. The round's first tee time is
 * its date at the earliest group's tee time, in the tournament's time zone.
 */
export function firstTeeInstant(
  roundDate: Date | null,
  groupTeeTimes: Array<Date | null>,
  timeZone: string | null,
): Date | null {
  if (!roundDate) return null
  const minutes = groupTeeTimes
    .filter((t): t is Date => !!t)
    .map((t) => t.getUTCHours() * 60 + t.getUTCMinutes())
  if (minutes.length === 0) return null
  const earliest = Math.min(...minutes)
  const tz = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE
  return zonedWallClockToUtc(
    roundDate.getUTCFullYear(),
    roundDate.getUTCMonth(),
    roundDate.getUTCDate(),
    Math.floor(earliest / 60),
    earliest % 60,
    tz,
  )
}

/**
 * Whether a round is open for scoring.
 *
 * Round 1 opens with the tournament. A later round opens when an admin
 * launches it, or automatically 3 hours before its first tee time. A round
 * someone has already scored in stays open no matter what, so turning this
 * rule on can never lock people out of a round they're playing.
 */
export function roundOpenState(
  round: { roundNumber: number; openedAt: Date | null; hasScores: boolean },
  firstTee: Date | null,
  now: Date = new Date(),
): RoundOpenState {
  const opensAt = firstTee ? new Date(firstTee.getTime() - AUTO_OPEN_LEAD_MS) : null
  if (round.roundNumber <= 1) return { open: true, reason: 'first-round', opensAt }
  if (round.openedAt) return { open: true, reason: 'launched', opensAt }
  if (round.hasScores) return { open: true, reason: 'started', opensAt }
  if (opensAt && now.getTime() >= opensAt.getTime()) return { open: true, reason: 'auto', opensAt }
  if (opensAt) return { open: false, reason: 'scheduled', opensAt }
  return { open: false, reason: 'needs-launch', opensAt: null }
}

export interface RoundWithOpenState extends RoundOpenState {
  id: string
  roundNumber: number
  openedAt: Date | null
}

/** Open/closed state for every round of a tournament. */
export async function getTournamentRoundStates(tournamentId: string, now: Date = new Date()): Promise<{
  timeZone: string
  rounds: RoundWithOpenState[]
}> {
  const [tournament, rounds, groups, scored] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId }, select: { timeZone: true } }),
    prisma.tournamentRound.findMany({
      where: { tournamentId },
      orderBy: { roundNumber: 'asc' },
      select: { id: true, roundNumber: true, date: true, openedAt: true },
    }),
    prisma.tournamentGroup.findMany({ where: { tournamentId }, select: { teeTime: true } }),
    prisma.score.groupBy({
      by: ['roundId'],
      where: { round: { tournamentId } },
      _count: { _all: true },
    }),
  ])
  const timeZone = isValidTimeZone(tournament?.timeZone) ? tournament!.timeZone! : FALLBACK_TIME_ZONE
  const withScores = new Set(scored.filter((s) => s._count._all > 0).map((s) => s.roundId))
  const teeTimes = groups.map((g) => g.teeTime)
  return {
    timeZone,
    rounds: rounds.map((r) => ({
      id: r.id,
      roundNumber: r.roundNumber,
      openedAt: r.openedAt,
      ...roundOpenState(
        { roundNumber: r.roundNumber, openedAt: r.openedAt, hasScores: withScores.has(r.id) },
        firstTeeInstant(r.date, teeTimes, timeZone),
        now,
      ),
    })),
  }
}

/** "Sun, Sep 27, 9:30 AM" in the tournament's time zone. */
export function formatOpensAt(d: Date, timeZone: string): string {
  return d.toLocaleString('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
