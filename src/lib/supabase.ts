import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Memoized so importing this module never constructs a client — an eager
// createClient() at module scope throws "supabaseUrl is required" during
// `next build` page-data collection, where the env vars aren't present.
let client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return client
}
