import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations need a direct (or session-mode) connection. The runtime
    // DATABASE_URL points at Supabase's transaction-mode pgbouncer (port 6543),
    // which breaks `prisma migrate deploy` — it hangs on advisory locks
    // pgbouncer doesn't support across queries. DIRECT_URL points at port 5432.
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL']!,
  },
})
