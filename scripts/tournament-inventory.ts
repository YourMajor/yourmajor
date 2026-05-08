import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function main() {
  process.stdout.write('starting...\n')
  try {
    const count = await prisma.tournament.count()
    process.stdout.write(`tournament count: ${count}\n`)
    const tournaments = await prisma.tournament.findMany({
      select: {
        slug: true,
        name: true,
        tournamentFormat: true,
        handicapSystem: true,
        status: true,
        teamsEnabled: true,
        _count: { select: { teams: true, players: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    process.stdout.write(JSON.stringify(tournaments, null, 2) + '\n')
  } catch (err) {
    process.stderr.write(`ERROR: ${err}\n`)
  }
}

main().finally(() => process.exit(0))
