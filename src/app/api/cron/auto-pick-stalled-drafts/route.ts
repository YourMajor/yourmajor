import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeCurrentTurn } from '@/lib/draft-utils'
import { executePick } from '@/lib/draft-pick'
import { selectAutoPickPowerupId } from '@/lib/draft-auto-pick'
import { sendPushToUser } from '@/lib/push'
import { broadcastDraftPick } from '@/lib/draft-broadcast'

const CLOCK_SKEW_GRACE_MS = 2_000
const MAX_DRAFTS_PER_RUN = 50

// Backstop for active drafts where every client has disconnected. Fires every
// minute (configured in vercel.json). Connected clients trigger the user-facing
// /auto-pick endpoint first; this exists so a draft can't stall indefinitely.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const candidates = await prisma.draft.findMany({
    where: {
      status: 'ACTIVE',
      turnStartedAt: { not: null },
      turnSeconds: { not: null },
    },
    select: {
      id: true,
      turnSeconds: true,
      turnStartedAt: true,
      tournamentId: true,
    },
    take: MAX_DRAFTS_PER_RUN,
  })

  const stalled = candidates.filter((d) => {
    if (!d.turnStartedAt || !d.turnSeconds) return false
    const expiresAt = d.turnStartedAt.getTime() + d.turnSeconds * 1000 + CLOCK_SKEW_GRACE_MS
    return expiresAt < now.getTime()
  })

  const results: Array<{ draftId: string; ok: boolean; pickId?: string; error?: string }> = []

  for (const d of stalled) {
    try {
      const tournament = await prisma.tournament.findUnique({
        where: { id: d.tournamentId },
        select: { slug: true, name: true },
      })

      const out = await prisma.$transaction(async (tx) => {
        const fresh = await tx.draft.findUnique({
          where: { id: d.id },
          include: {
            picks: { include: { powerup: { select: { type: true } } } },
            tournament: {
              select: {
                powerupsPerPlayer: true,
                maxAttacksPerPlayer: true,
                tournamentPowerups: {
                  select: { powerup: { select: { id: true, type: true } } },
                },
              },
            },
          },
        })

        if (!fresh || fresh.status !== 'ACTIVE') return null
        if (!fresh.turnSeconds || fresh.turnSeconds <= 0 || !fresh.turnStartedAt) return null

        const elapsedMs = Date.now() - fresh.turnStartedAt.getTime()
        if (elapsedMs < fresh.turnSeconds * 1000 - CLOCK_SKEW_GRACE_MS) return null

        const draftOrder = fresh.draftOrder as string[]
        const currentTurn = computeCurrentTurn(
          draftOrder,
          fresh.format,
          fresh.currentPick,
          fresh.tournament.powerupsPerPlayer,
        )
        if (!currentTurn) return null

        const candidates = fresh.tournament.tournamentPowerups.map((tp) => ({
          id: tp.powerup.id,
          type: tp.powerup.type as 'BOOST' | 'ATTACK',
        }))

        const history = fresh.picks.map((p) => ({
          tournamentPlayerId: p.tournamentPlayerId,
          powerupType: p.powerup.type as 'BOOST' | 'ATTACK',
          powerupId: p.powerupId,
        }))

        const chosen = selectAutoPickPowerupId(
          history,
          currentTurn.tournamentPlayerId,
          candidates,
          fresh.tournament.maxAttacksPerPlayer,
        )
        if (!chosen) throw new Error('No valid powerup available for auto-pick.')

        const picked = await executePick(tx, {
          draftId: fresh.id,
          tournamentPlayerId: currentTurn.tournamentPlayerId,
          powerupId: chosen,
          expectedCurrentPick: fresh.currentPick,
        })

        await tx.notification.create({
          data: {
            tournamentPlayerId: currentTurn.tournamentPlayerId,
            type: 'DRAFT_AUTO_PICK',
            payload: {
              pickNumber: picked.pick.pickNumber,
              powerupName: picked.pick.powerup.name,
              message: `Time expired — auto-picked "${picked.pick.powerup.name}" for you.`,
            },
          },
        })

        return picked
      })

      if (out) {
        void broadcastDraftPick(d.id)
      }

      if (out && out.nextPickerUserId && tournament) {
        void sendPushToUser(out.nextPickerUserId, {
          title: `${tournament.name} — You're on the clock`,
          body: "It's your turn to pick a powerup.",
          url: `/${tournament.slug}/draft`,
        }).catch((err) => console.error('[push] cron auto-pick dispatch failed', err))
      }

      results.push({
        draftId: d.id,
        ok: true,
        pickId: out?.pick.id,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown'
      // P2002 means a connected client already auto-picked this turn — not an error
      const code = (err as { code?: string } | undefined)?.code
      results.push({
        draftId: d.id,
        ok: code === 'P2002',
        error: code === 'P2002' ? 'already-picked' : message,
      })
    }
  }

  return NextResponse.json({
    processedAt: now.toISOString(),
    scanned: candidates.length,
    stalled: stalled.length,
    results,
  })
}
