/**
 * Clean production database — removes all tournaments, fake users, and courses.
 * Keeps: real users (Hartley & Michael), powerups.
 *
 * Run with:
 *   npx tsx scripts/clean-prod.ts --dry-run   # preview only
 *   npx tsx scripts/clean-prod.ts              # execute deletions
 */
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(DRY_RUN ? '\n=== DRY RUN (no changes will be made) ===\n' : '\n=== LIVE RUN ===\n')

  // Step 1: Query current state
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } })
  const tournaments = await prisma.tournament.findMany({ select: { id: true, name: true, status: true } })
  const courses = await prisma.course.findMany({ select: { id: true, name: true } })

  console.log(`Users (${users.length}):`)
  users.forEach(u => console.log(`  ${u.name ?? '(no name)'} — ${u.email} [${u.id}]`))

  console.log(`\nTournaments (${tournaments.length}):`)
  tournaments.forEach(t => console.log(`  ${t.name} (${t.status}) [${t.id}]`))

  console.log(`\nCourses (${courses.length}):`)
  courses.forEach(c => console.log(`  ${c.name} [${c.id}]`))

  // Identify real users (Hartley & Michael)
  const realUsers = users.filter(u =>
    u.email.toLowerCase().includes('hartley') ||
    u.name?.toLowerCase().includes('hartley') ||
    u.email.toLowerCase().includes('michael') ||
    u.name?.toLowerCase().includes('michael')
  )
  const fakeUsers = users.filter(u => !realUsers.some(r => r.id === u.id))

  console.log(`\n--- Keeping ${realUsers.length} real user(s): ---`)
  realUsers.forEach(u => console.log(`  ${u.name} — ${u.email}`))

  console.log(`\n--- Will delete ${fakeUsers.length} fake user(s): ---`)
  fakeUsers.forEach(u => console.log(`  ${u.name ?? '(no name)'} — ${u.email}`))

  console.log(`--- Will delete ${tournaments.length} tournament(s) ---`)
  console.log(`--- Will delete ${courses.length} course(s) ---`)
  console.log(`--- Keeping powerups ---`)

  if (DRY_RUN) {
    console.log('\nDry run complete. Re-run without --dry-run to execute.\n')
    return
  }

  // Step 2: Delete all tournaments (cascades to rounds, scores, players, groups, etc.)
  const deletedTournaments = await prisma.tournament.deleteMany({})
  console.log(`\nDeleted ${deletedTournaments.count} tournament(s)`)

  // Step 3: Delete fake users (cascades to accounts, sessions, profiles, etc.)
  const realUserIds = realUsers.map(u => u.id)
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { notIn: realUserIds } },
  })
  console.log(`Deleted ${deletedUsers.count} user(s)`)

  // Step 4: Clean up orphaned records
  const deletedCourses = await prisma.course.deleteMany({})
  console.log(`Deleted ${deletedCourses.count} course(s)`)

  const deletedTokens = await prisma.verificationToken.deleteMany({})
  console.log(`Deleted ${deletedTokens.count} verification token(s)`)

  const deletedNotifications = await prisma.notification.deleteMany({})
  console.log(`Deleted ${deletedNotifications.count} notification(s)`)

  // Final state
  const remainingUsers = await prisma.user.findMany({ select: { email: true, name: true } })
  console.log(`\n=== Done. Remaining users (${remainingUsers.length}): ===`)
  remainingUsers.forEach(u => console.log(`  ${u.name} — ${u.email}`))
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
