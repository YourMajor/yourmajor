import { prisma } from '../src/lib/prisma'

async function main() {
  const enumVals = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'TournamentFormat')
    ORDER BY enumsortorder;
  `
  console.log('TournamentFormat values:', enumVals.map((r) => r.enumlabel))

  const owner = await prisma.$queryRaw<Array<{ typname: string; usename: string }>>`
    SELECT t.typname, u.usename
    FROM pg_type t JOIN pg_user u ON t.typowner = u.usesysid
    WHERE t.typname = 'TournamentFormat';
  `
  console.log('Owner:', owner)

  const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Tournament' AND column_name IN ('formatConfig', 'teamsEnabled', 'seasonDropLowest', 'seasonTiebreakers', 'seasonAttendanceBonus');
  `
  console.log('New Tournament columns present:', cols.map((c) => c.column_name))

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('TournamentTeam', 'TournamentTeamMember', 'SeasonAdjustment');
  `
  console.log('New tables present:', tables.map((t) => t.table_name))
}

main().finally(() => prisma.$disconnect())
