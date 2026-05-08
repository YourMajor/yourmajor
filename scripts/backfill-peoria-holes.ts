// One-shot backfill: pick 6 secret holes for any TournamentRound belonging to
// a PEORIA tournament that doesn't already have a set. Idempotent — re-running
// is a no-op for rounds that already have peoriaHoles populated.
//
// Run after the 20260507400000_add_peoria_holes migration is applied:
//   npx tsx scripts/backfill-peoria-holes.ts

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { selectPeoriaHoles } from '../src/lib/peoria'

async function main() {
  const rounds = await prisma.tournamentRound.findMany({
    where: {
      tournament: { tournamentFormat: 'PEORIA' },
      peoriaHoles: { isEmpty: true },
    },
    select: {
      id: true,
      roundNumber: true,
      courseId: true,
      tournament: { select: { slug: true } },
    },
  })

  if (rounds.length === 0) {
    console.log('No Peoria rounds need backfilling.')
    return
  }

  console.log(`Backfilling peoriaHoles for ${rounds.length} round(s)...`)
  for (const round of rounds) {
    const holes = await prisma.hole.findMany({
      where: { courseId: round.courseId },
      select: { number: true, par: true },
    })
    try {
      const peoriaHoles = selectPeoriaHoles(holes)
      await prisma.tournamentRound.update({
        where: { id: round.id },
        data: { peoriaHoles },
      })
      console.log(`  ${round.tournament.slug} R${round.roundNumber}: ${peoriaHoles.join(', ')}`)
    } catch (err) {
      console.error(
        `  ${round.tournament.slug} R${round.roundNumber}: SKIPPED — ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
  }
  console.log('Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
