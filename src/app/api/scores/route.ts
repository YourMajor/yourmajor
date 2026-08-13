import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { isSingleTeamScoreFormat, isMatchFormat } from '@/lib/formats'

export async function POST(request: NextRequest) {
  const dbUser = await getUser()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { tournamentPlayerId, holeId, roundId, strokes, fairwayHit, gir, putts, conceded } = body

  const isConceded = conceded === true
  if (!tournamentPlayerId || !holeId || !roundId || (strokes == null && !isConceded)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // When conceded, strokes are optional and may be 0 (the player did not finish
  // the hole). Otherwise enforce the standard 1–20 range.
  const persistedStrokes: number = isConceded ? (typeof strokes === 'number' ? strokes : 0) : strokes
  if (!isConceded) {
    if (typeof strokes !== 'number' || !Number.isInteger(strokes) || strokes < 1 || strokes > 20) {
      return NextResponse.json({ error: 'Strokes must be an integer between 1 and 20' }, { status: 400 })
    }
  } else if (typeof persistedStrokes !== 'number' || persistedStrokes < 0 || persistedStrokes > 20) {
    return NextResponse.json({ error: 'Strokes for a conceded hole must be 0–20' }, { status: 400 })
  }
  if (putts != null && (typeof putts !== 'number' || !Number.isInteger(putts) || putts < 0 || putts > 10)) {
    return NextResponse.json({ error: 'Putts must be an integer between 0 and 10' }, { status: 400 })
  }

  const tp = await prisma.tournamentPlayer.findUnique({
    where: { id: tournamentPlayerId },
    select: {
      userId: true,
      tournamentId: true,
      isAdmin: true,
      teamMembership: { select: { teamId: true } },
      tournament: { select: { status: true } },
    },
  })
  if (!tp) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const isOwn = tp.userId === dbUser.id
  const isGlobalAdmin = dbUser.role === 'ADMIN'
  let isTournamentAdmin = false
  let isTeammate = false
  if (!isOwn && !isGlobalAdmin) {
    const callerMembership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tp.tournamentId, userId: dbUser.id } },
      select: { isAdmin: true, teamMembership: { select: { teamId: true } } },
    })
    isTournamentAdmin = callerMembership?.isAdmin ?? false
    // Team-mode entry: any member of the same team as the target player may
    // submit, but only when the tournament's format actually uses a single
    // team-anchor score (Scramble / Shamble / Chapman / Pinehurst).
    if (!isTournamentAdmin && callerMembership?.teamMembership?.teamId
        && tp.teamMembership?.teamId === callerMembership.teamMembership.teamId) {
      const tournamentFormat = await prisma.tournament.findUnique({
        where: { id: tp.tournamentId },
        select: { tournamentFormat: true },
      })
      if (isSingleTeamScoreFormat(tournamentFormat?.tournamentFormat)) {
        isTeammate = true
      }
    }
  }
  if (!isOwn && !isGlobalAdmin && !isTournamentAdmin && !isTeammate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Completion freezes the card. Nothing else did: this route busts the
  // leaderboard cache tag on every write and season standings include
  // COMPLETED events, so a player (or their teammate) could still rewrite a
  // finished leaderboard. Admins keep writing — the admin scorecard editor
  // posts to this same route and corrections after the fact are its job.
  // `tp.isAdmin` is the target row's flag, so it only stands in for the writer
  // when the writer is the target (isOwn); otherwise isTournamentAdmin above
  // is the caller's own flag.
  const writerIsAdmin = isGlobalAdmin || isTournamentAdmin || (isOwn && tp.isAdmin)
  if (tp.tournament.status === 'COMPLETED' && !writerIsAdmin) {
    return NextResponse.json(
      { error: 'Tournament completed — scores are final.' },
      { status: 409 },
    )
  }

  // Scope roundId and holeId to the player's tournament. Both are caller-
  // supplied and reach the upsert unmodified; without this a legitimate player
  // could post their own tournamentPlayerId against a hole from another
  // course, and getLeaderboard reads par off the score's own hole — so a
  // par-5 hole with strokes:3 improves their net. Same reason and same shape
  // as the scoping in powerups/activate. findFirst, not findUnique: there is
  // no compound unique on (id, tournamentId).
  const round = await prisma.tournamentRound.findFirst({
    where: { id: roundId, tournamentId: tp.tournamentId },
    select: { courseId: true },
  })
  if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 })

  const hole = await prisma.hole.findFirst({
    where: { id: holeId, courseId: round.courseId },
    select: { id: true },
  })
  if (!hole) return NextResponse.json({ error: 'Hole not found' }, { status: 404 })

  // A hole may only be conceded in a match-play format. This rule used to live
  // only in the client (LiveScoring renders the Concede button behind the same
  // predicate), so a caller posting `conceded: true` by hand unlocked the 0-
  // stroke branch above in any format — and strokePlay/stableford still count
  // the hole's par, so a 0-stroke round scored top of the leaderboard. Same
  // predicate as the UI: FORMATS' own `kind: 'match'` (MATCH_PLAY, RYDER_CUP,
  // NASSAU), which are exactly the formats whose strategies read `conceded`.
  // Separate lookup rather than a join on the findUnique above so the two
  // reads stay independent.
  if (isConceded) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tp.tournamentId },
      select: { tournamentFormat: true },
    })
    if (!isMatchFormat(tournament?.tournamentFormat)) {
      return NextResponse.json(
        { error: 'A hole can only be conceded in a match-play format' },
        { status: 400 },
      )
    }
  }

  // Check if this is a new score (not an update) to trigger round-start message
  const existingScore = await prisma.score.findUnique({
    where: { tournamentPlayerId_holeId_roundId: { tournamentPlayerId, holeId, roundId } },
  })
  const isNewScore = !existingScore

  const score = await prisma.score.upsert({
    where: { tournamentPlayerId_holeId_roundId: { tournamentPlayerId, holeId, roundId } },
    create: { tournamentPlayerId, holeId, roundId, strokes: persistedStrokes, fairwayHit, gir, putts, conceded: isConceded },
    update: { strokes: persistedStrokes, fairwayHit, gir, putts, conceded: isConceded, submittedAt: new Date() },
  })

  // Bust the leaderboard SSR cache so the next server-rendered visit (e.g. a
  // spectator opening the hub) sees the fresh standing immediately. Live
  // clients still receive the same change via Supabase Realtime within ~200ms.
  // expire:0 = hard immediate eviction (Next 16 requires the profile arg).
  revalidateTag(`leaderboard-${tp.tournamentId}`, { expire: 0 })

  // Auto-post "Round has begun!" system message on first score for a round.
  // Claimed with a conditional write rather than a count() == 1 check: that
  // check both ran on every new score and raced — two players submitting
  // their first score together each saw a count of 2, so the message was
  // silently skipped. Same pattern as the powerup claim in powerups/activate.
  if (isNewScore) {
    const claimed = await prisma.tournamentRound.updateMany({
      where: { id: roundId, tournamentId: tp.tournamentId, roundStartAnnouncedAt: null },
      data: { roundStartAnnouncedAt: new Date() },
    })
    if (claimed.count === 1) {
      const round = await prisma.tournamentRound.findUnique({
        where: { id: roundId },
        select: { roundNumber: true, tournamentId: true },
      })
      if (round) {
        const totalRounds = await prisma.tournamentRound.count({
          where: { tournamentId: round.tournamentId },
        })

        let chatMessage: string
        if (totalRounds === 1) {
          chatMessage = '🏌️ The Tournament has begun! Good luck everyone!'
        } else if (round.roundNumber === 1) {
          chatMessage = `🏌️ Round 1 has begun! Good luck everyone!`
        } else {
          // Round > 1: include leaderboard standings from previous rounds
          let leaderSummary = ''
          try {
            const { getLeaderboard } = await import('@/lib/scoring')
            const { formatVsPar } = await import('@/lib/scoring-utils')
            const standings = await getLeaderboard(round.tournamentId)
            const top = standings.filter((s) => s.holesPlayed > 0).slice(0, 3)
            if (top.length > 0) {
              const tournament = await prisma.tournament.findUnique({
                where: { id: round.tournamentId },
                select: { handicapSystem: true },
              })
              const isStableford = tournament?.handicapSystem === 'STABLEFORD'
              const lines = top.map((s, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
                const score = isStableford
                  ? `${s.points ?? 0} pts`
                  : `Net ${formatVsPar(s.netVsPar)}`
                return `${medal} ${s.playerName} (${score})`
              })
              leaderSummary = `\n\nStandings after Round ${round.roundNumber - 1}:\n${lines.join('\n')}`
            }
          } catch {
            // Non-critical — post message without standings
          }
          chatMessage = `🏌️ Round ${round.roundNumber} has begun! Good luck everyone!${leaderSummary}`
        }

        // Kept after the claim above, and now reached once per round rather
        // than once per score: rounds that were already under way when
        // roundStartAnnouncedAt was added have a null claim, so the first
        // score after deploy would otherwise re-announce them. This makes the
        // column a pure additive migration with no backfill.
        const existing = await prisma.tournamentMessage.findFirst({
          where: {
            tournamentId: round.tournamentId,
            isSystem: true,
            content: { startsWith: `🏌️ Round ${round.roundNumber} has begun` },
          },
        })
        // Also check for single-round tournament message
        const existingSingle = totalRounds === 1 ? await prisma.tournamentMessage.findFirst({
          where: {
            tournamentId: round.tournamentId,
            isSystem: true,
            content: { startsWith: '🏌️ The Tournament has begun' },
          },
        }) : null
        if (!existing && !existingSingle) {
          await prisma.tournamentMessage.create({
            data: {
              tournamentId: round.tournamentId,
              userId: dbUser.id,
              content: chatMessage,
              isSystem: true,
            },
          })
        }
      }
    }
  }

  // Evaluate active variable powerups after score save
  let powerupEvaluations: Array<{ playerPowerupId: string; slug: string; outcome: string; scoreModifier: number | null; message: string }> = []
  // Confirmations the saver should answer (BOOST cards they activated whose
  // hole is now scored). ATTACK confirmations where the saver is the target
  // do NOT surface here — those reach the attacker via the GET endpoint.
  let pendingConfirmations: Awaited<ReturnType<typeof import('@/lib/variable-powerup-evaluator')['findPendingConfirmations']>> = []
  try {
    const {
      evaluateActiveVariablePowerups,
      evaluateAsKothTarget,
      evaluateAsDoubleOrNothingTarget,
      evaluatePostHoleAttacks,
      findPendingConfirmations,
    } = await import('@/lib/variable-powerup-evaluator')
    const [ownResults, kothResults, donResults, postHoleAttacks, pending] = await Promise.all([
      evaluateActiveVariablePowerups(tournamentPlayerId, roundId),
      evaluateAsKothTarget(tournamentPlayerId, roundId),
      evaluateAsDoubleOrNothingTarget(tournamentPlayerId, roundId),
      evaluatePostHoleAttacks(tournamentPlayerId, roundId),
      findPendingConfirmations(tournamentPlayerId, roundId),
    ])
    powerupEvaluations = [...ownResults, ...kothResults, ...donResults, ...postHoleAttacks]
    pendingConfirmations = pending
  } catch (err) {
    console.error('[scores] Variable powerup evaluation failed:', err)
  }

  return NextResponse.json({ ...score, powerupEvaluations, pendingConfirmations })
}
