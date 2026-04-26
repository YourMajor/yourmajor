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
//
// dotenv loaded so .env.local (local dev) is visible to the gate logic —
// otherwise my process.env.DATABASE_URL view would diverge from what
// prisma CLI sees via its own dotenv load, and we'd skip locally.
import 'dotenv/config'
import { spawnSync } from 'node:child_process'

function run(commandLine) {
  const r = spawnSync(commandLine, { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const skipReasons = []
if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  skipReasons.push('no DATABASE_URL/DIRECT_URL')
}
if (process.env.GITHUB_ACTIONS === 'true') {
  // GitHub Actions sets DATABASE_URL to a fake localhost URL for build
  // verification. migrate would just fail with P1001; the build is
  // verified by tsc + lint + vitest + next build, no DB needed.
  // (Don't gate on CI=1 because Vercel also sets that.)
  skipReasons.push('GITHUB_ACTIONS')
}

if (skipReasons.length === 0) {
  run('npx prisma migrate deploy')
} else {
  console.log(`[build] skipping prisma migrate deploy: ${skipReasons.join(', ')}`)
}
run('npx prisma generate')
run('npx next build')
