import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dispatchPendingAnnouncement } from '@/lib/league-announcements'

// Cadence is configured in vercel.json (`*/5 * * * *`). Vercel pings this route
// with `Authorization: Bearer ${CRON_SECRET}`; reject anything else so a leaked
// URL can't drain the queue.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  // Drain up to 200 per run instead of 50 — the previous limit took 16+ hours
  // to clear a 1k+ backlog at the 5-minute cadence. Each dispatch awaits its
  // own outbound I/O, so we still cap to keep the function under the serverless
  // execution window.
  const due = await prisma.leagueAnnouncement.findMany({
    where: { status: 'PENDING', scheduledFor: { lte: now } },
    select: { id: true },
    take: 200,
  })

  const results: { id: string; ok: boolean; deliveryCount?: number; successCount?: number; error?: string }[] = []
  for (const row of due) {
    const r = await dispatchPendingAnnouncement(row.id)
    if (r.ok) {
      results.push({ id: row.id, ok: true, deliveryCount: r.deliveryCount, successCount: r.successCount })
    } else {
      results.push({ id: row.id, ok: false, error: r.error })
    }
  }

  return NextResponse.json({ processedAt: now.toISOString(), count: results.length, results })
}
