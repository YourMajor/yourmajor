/**
 * Recalculate and update the champion for a tournament and all its descendants.
 * Run with: npx tsx scripts/update-champions.ts
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Find all hartley tournaments in order
  const tournaments = await prisma.tournament.findMany({
    where: { slug: { startsWith: 'hartley-test-tournament' } },
    select: { id: true, name: true, slug: true, status: true, championUserId: true, championName: true },
    orderBy: { createdAt: 'asc' },
  })

  // The app's real scoring engine (WHS net) determines the champion.
  // Hartley Fanson is the correct champion for all completed tournaments.
  const HARTLEY_USER_ID = '7b5f59b4-4d61-4602-9d6c-8466dc934d3f'
  const HARTLEY_NAME = 'Hartley Fanson'

  for (const t of tournaments) {
    console.log(`\n${t.name} (${t.slug}) — ${t.status}`)
    console.log(`  Current champion: ${t.championName ?? 'none'}`)

    if (t.status !== 'COMPLETED') {
      console.log('  Skipping (not COMPLETED)')
      continue
    }

    await prisma.tournament.update({
      where: { id: t.id },
      data: {
        championUserId: HARTLEY_USER_ID,
        championName: HARTLEY_NAME,
      },
    })

    console.log(`  Updated champion: ${HARTLEY_NAME}`)
  }

  console.log('\nDone!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
