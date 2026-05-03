#!/usr/bin/env node
// After manually applying a migration's SQL via Supabase Studio (because the
// app_dev role lacks ALTER), run this to mark the migration as applied in the
// _prisma_migrations tracking table. `prisma migrate resolve` only writes to
// _prisma_migrations — it does not execute schema changes — so it works fine
// with the same restricted role used at runtime.
//
// Usage:
//   npm run migrate:resolve -- <migration_name>
//   npm run migrate:resolve -- <migration_name> --prod
//   npm run migrate:resolve -- <migration_name> --both
//
// --prod  resolves against the URL in .env.production.local
// --both  resolves against dev (.env.local) then prod (.env.production.local)
// (default) resolves against dev (.env.local)

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const positional = args.filter((a) => !a.startsWith('--'))
const name = positional[0]

if (!name) {
  console.error('Usage: npm run migrate:resolve -- <migration_name> [--prod|--both]')
  console.error('       <migration_name> matches a folder under prisma/migrations/')
  process.exit(2)
}

// Validate the migration folder actually exists locally so typos surface fast.
const localFolder = resolvePath('prisma', 'migrations', name)
if (!existsSync(localFolder)) {
  console.error(`No migration folder at ${localFolder}`)
  console.error('Check the name matches a directory under prisma/migrations/.')
  process.exit(2)
}

function loadEnv(envFile) {
  const path = resolvePath(envFile)
  if (!existsSync(path)) {
    console.error(`Missing ${envFile}`)
    process.exit(2)
  }
  const env = {}
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const [, k, v] = m
    env[k] = v.replace(/^["']|["']$/g, '')
  }
  return env
}

function resolveAgainst(label, envFile) {
  const env = loadEnv(envFile)
  const url = env.DIRECT_URL ?? env.DATABASE_URL
  if (!url) {
    console.error(`[${label}] no DIRECT_URL or DATABASE_URL in ${envFile}`)
    process.exit(2)
  }

  console.log(`\n[${label}] marking ${name} as applied`)
  const r = spawnSync(
    'npx',
    ['prisma', 'migrate', 'resolve', '--applied', name],
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, ...env, DIRECT_URL: url, DATABASE_URL: url },
    },
  )
  if (r.status !== 0) {
    console.error(`[${label}] prisma migrate resolve failed (exit ${r.status})`)
    process.exit(r.status ?? 1)
  }
  console.log(`[${label}] ✓ resolved`)
}

if (flags.has('--both')) {
  resolveAgainst('DEV', '.env.local')
  resolveAgainst('PROD', '.env.production.local')
} else if (flags.has('--prod')) {
  resolveAgainst('PROD', '.env.production.local')
} else {
  resolveAgainst('DEV', '.env.local')
}
