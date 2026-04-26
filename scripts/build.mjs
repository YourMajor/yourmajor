#!/usr/bin/env node
// Build pipeline: migrate (if DB url configured), generate, next build.
//
// Why the gate: Vercel Preview scope doesn't always have DATABASE_URL /
// DIRECT_URL configured — historically the build script was just
// `prisma generate && next build`, which doesn't need a connection.
// `prisma migrate deploy` does need one, so it errors with
// "datasource.url property is required" when those vars aren't present.
// Production scope has them, so prod merges still migrate as DEPLOYMENT.md
// intends; Preview just skips migrate and builds the bundle.
import { spawnSync } from 'node:child_process'

function run(commandLine) {
  const r = spawnSync(commandLine, { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const hasDb = Boolean(process.env.DIRECT_URL || process.env.DATABASE_URL)
if (hasDb) {
  run('npx prisma migrate deploy')
} else {
  console.log('[build] No DATABASE_URL/DIRECT_URL — skipping prisma migrate deploy')
}
run('npx prisma generate')
run('npx next build')
