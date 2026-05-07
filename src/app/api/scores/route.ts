import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'

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
    select: { userId: true, tournamentId: true },
  })
  if (!tp) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const isOwn = tp.userId === dbUser.id
  const isGlobalAdmin = dbUser.role === 'ADMIN'
  let isTournamentAdmin = false
  if (!isOwn && !isGlobalAdmin) {
    const adminMembership = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tp.tournamentId, userId: dbUser.id } },
      select: { isAdmin: true },
    })
    isTournamentAdmin = adminMembership?.isAdmin ?? false
  }
  if (!isOwn && !isGlobalAdmin && !isTournamentAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

  // Auto-post "Round has begun!" system message on first score for a round
  if (isNewScore) {
    const totalScoresForRound = await prisma.score.count({ where: { roundId } })
    if (totalScoresForRound === 1) {
      // This is the very first score submitted for this round
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

        // Check if a round-start message already exists for this round (prevent duplicates)
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
