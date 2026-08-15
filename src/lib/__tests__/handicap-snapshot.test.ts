import { describe, it, expect, vi } from 'vitest'
import type { Prisma } from '@/generated/prisma/client'
import { snapshotHandicapOnActivation } from '../handicap-snapshot'

// The activation snapshot exists to fill in the zero that scoring's old
// `p.handicap || profile.handicap || 0` fallback used to cover. Its whole value
// is in what it REFUSES to write: a row holding a real handicap is somebody's
// registration or admin-set snapshot, and a row that has scored was played
// against the value it stores. Both are checked in the updateMany's `where`, so
// the fake below actually evaluates that `where` against rows rather than just
// recording the call — a gate that stopped matching would fail these.

type Row = { id: string; handicap: number; scoreCount: number }

type UpdateManyArgs = {
  where: { id: string; handicap: number; scores?: { none: Record<string, never> } }
  data: { handicap: number }
}

function fakeDb(rows: Row[]) {
  return {
    tournamentPlayer: {
      updateMany: vi.fn(async ({ where, data }: UpdateManyArgs) => {
        const matched = rows.filter(
          (r) =>
            r.id === where.id &&
            r.handicap === where.handicap &&
            (where.scores?.none === undefined || r.scoreCount === 0),
        )
        for (const r of matched) r.handicap = data.handicap
        return { count: matched.length }
      }),
    },
  }
}

/** The helper takes a Prisma/transaction client; the fake stands in for one. */
function run(db: ReturnType<typeof fakeDb>, id: string, profileHandicap: number) {
  return snapshotHandicapOnActivation(
    db as unknown as Prisma.TransactionClient,
    id,
    profileHandicap,
  )
}

describe('snapshotHandicapOnActivation', () => {
  it('writes the profile handicap onto an unscored row still holding the default 0', async () => {
    const rows: Row[] = [{ id: 'tp_1', handicap: 0, scoreCount: 0 }]

    await expect(run(fakeDb(rows), 'tp_1', 12)).resolves.toBe(true)
    expect(rows[0].handicap).toBe(12)
  })

  it('never rewrites a row that already stores a real handicap', async () => {
    // Set at registration or by an admin. Rewriting it would move this
    // player's net scores, which is the defect this whole change is about.
    const rows: Row[] = [{ id: 'tp_1', handicap: 8, scoreCount: 0 }]

    await expect(run(fakeDb(rows), 'tp_1', 12)).resolves.toBe(false)
    expect(rows[0].handicap).toBe(8)
  })

  it('refuses the write when scores exist, even though the row stores 0', async () => {
    // A stored 0 is not proof the row never played: removing a player clears
    // isParticipant but leaves their scores behind, so the row can come back
    // through an activation path with a card already on it.
    const rows: Row[] = [{ id: 'tp_1', handicap: 0, scoreCount: 18 }]

    await expect(run(fakeDb(rows), 'tp_1', 12)).resolves.toBe(false)
    expect(rows[0].handicap).toBe(0)
  })

  it('touches no other player row', async () => {
    const rows: Row[] = [
      { id: 'tp_1', handicap: 0, scoreCount: 0 },
      { id: 'tp_2', handicap: 0, scoreCount: 0 },
    ]

    await run(fakeDb(rows), 'tp_1', 12)
    expect(rows[1].handicap).toBe(0)
  })

  it('issues no write at all for a scratch profile', async () => {
    const db = fakeDb([{ id: 'tp_1', handicap: 0, scoreCount: 0 }])

    await expect(run(db, 'tp_1', 0)).resolves.toBe(false)
    expect(db.tournamentPlayer.updateMany).not.toHaveBeenCalled()
  })
})
