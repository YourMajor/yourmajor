# Deployment & Schema Rules

## Workflow

```
localhost (dev DB)
   │  npm run qa         # typecheck + lint + tests + build (also runs migrate deploy)
   │  git push           # opens Vercel preview build for the branch
   │  open PR → master   # branch protection forces a PR
   │  merge              # Vercel prod build runs migrate deploy first, then deploys
   ▼
prod (always in sync with the codebase)
```

Three commands, three environments, no manual schema steps.

## The non-negotiables

### 1. Schema only changes via Prisma migrations

**Never** run `ALTER TABLE` / `CREATE TABLE` / etc. directly against any environment via the Supabase dashboard or psql. Once that becomes the workaround, drift is inevitable and recovery is painful (we paid for that lesson on 2026-04-25).

Workflow for any schema change:

```bash
# 1. Edit prisma/schema.prisma locally
# 2. Generate the migration + apply to dev
npx prisma migrate dev --name what_you_did

# 3. Commit BOTH the schema and the new migration folder together
git add prisma/schema.prisma prisma/migrations/<timestamp>_what_you_did/
git commit -m "feat(schema): what you did"
```

The build script (`prisma migrate deploy && prisma generate && next build`) applies pending migrations on every Vercel build — so as long as the migration is committed, prod gets it on the next merge to master.

### 2. The build always runs `prisma migrate deploy`

`package.json`:
```json
"build": "prisma migrate deploy && prisma generate && next build"
```

This means:

- **Local `npm run build`** → migrates the dev DB (your `.env` points there). Safe.
- **Vercel Preview build** → migrates the dev DB (Preview scope env var). Safe; repeated runs are idempotent.
- **Vercel Production build** → migrates the prod DB (Production scope env var). Single source of truth for prod schema.

If a migration ever fails, the Vercel build fails and the deploy is aborted. Prod stays consistent with whatever schema was last shipped.

### 3. Vercel env var scopes must match

In Vercel dashboard → Project Settings → Environment Variables:

| Variable | Production scope | Preview scope | Development scope |
|---|---|---|---|
| `DATABASE_URL` | prod (`wwwqjfjqlivdxloaysjd`) | dev (`rmyjjaxgtjjcaknqsows`) | dev |
| `DIRECT_URL` | prod direct | dev direct | dev |
| `NEXT_PUBLIC_SUPABASE_URL` | prod | dev | dev |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod | dev | dev |
| `SUPABASE_SERVICE_ROLE_KEY` | prod | dev | dev |
| `RESEND_API_KEY` | prod | prod (or test) | test |
| `STRIPE_*` | live | test | test |

**If Preview scope ever points at prod DATABASE_URL, every PR push migrates prod.** Verify scoping is correct before adding new env vars.

### 4. Branch model

- **`master`** — production. Protected: merges only via PR.
- **`feat/*`, `fix/*`** — short-lived feature branches off master. Vercel auto-creates preview URLs.
- **`develop`** — deprecated as of 2026-04-25. We dropped the two-branch dance because it added churn without buying staging value (preview URLs do that already).

## Recovery: if migrations get out of sync again

This actually happened on 2026-04-25 — five migrations had been applied to prod via dashboard SQL but `_prisma_migrations` didn't know. The fix:

1. Compare what's applied vs what's in `prisma/migrations/`:
   ```sql
   SELECT migration_name FROM "_prisma_migrations" ORDER BY started_at;
   ```
2. For each missing migration, either:
   - **The schema change isn't actually in the DB**: paste the migration SQL into Supabase SQL editor.
   - **The schema change IS in the DB** (drift): mark as applied without re-running. Locally:
     ```bash
     npx prisma migrate resolve --applied <migration_name>
     ```
     (requires a working DB connection.) Or backfill the row by hand:
     ```sql
     INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
     VALUES (gen_random_uuid()::text, '<sha256-of-migration-sql>', NOW(), '<name>', NOW(), 1);
     ```
3. Use `IF NOT EXISTS` aggressively when writing recovery SQL — partial drift is the norm, not the exception.

## One-time prod cleanup (do this once)

The 5 migrations we recovered manually on 2026-04-25 were inserted into
`_prisma_migrations` with the placeholder checksum `'manual-recovery'`.
Prisma's `migrate deploy` will warn (not fail) on checksum mismatch.
Replace the placeholders with the canonical SHA-256 values to silence the warnings:

```sql
-- Run once against the prod DB.
UPDATE "_prisma_migrations" SET checksum = '3f3bc27c5e06eaa2abb78726514bdf18c13de487fe7b81a87dd2eab7273d8bd7'
  WHERE migration_name = '20260424120000_add_invitation_expires_at';
UPDATE "_prisma_migrations" SET checksum = '92da4610c420dd4a70e2715085711f31c5ee6481da1fe5e8834c0f5fb64aed1a'
  WHERE migration_name = '20260424190000_add_format_library_and_teams';
UPDATE "_prisma_migrations" SET checksum = 'c27bac49968108710c4d4012f0d11d809ee718b720478aca4711678312b846ea'
  WHERE migration_name = '20260424200000_add_season_management';
UPDATE "_prisma_migrations" SET checksum = 'a9cc10104ad6165bae20985b85b0486fec11b86bcf8d37e651ea15124034c7e3'
  WHERE migration_name = '20260425000000_format_handicap_merge';
UPDATE "_prisma_migrations" SET checksum = '429b5ea6a1b87b07fe07d8dd732fc44629487ef5f0d51d7c6e0e6ef0eb8e06be'
  WHERE migration_name = '20260425120000_add_league_communications';
```

After this, `prisma migrate deploy` on prod runs silently — same as on dev.

## QA before pushing

```bash
npm run qa
```

That runs: `tsc --noEmit && npm run lint && npm run test && npm run build`. If any step fails, you didn't QA. Don't push.

## When in doubt

1. Local DB out of sync? `npx prisma migrate dev` (it'll apply pending + give you a chance to create new ones).
2. Want to verify a deploy went through? `SELECT migration_name FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5;` against the env you're checking.
3. Need to roll back? Migrations don't auto-rollback. Either write a down-migration or restore from a Supabase point-in-time backup.
