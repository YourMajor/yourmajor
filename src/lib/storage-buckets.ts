import type { SupabaseClient } from '@supabase/supabase-js'

export interface PublicBucketOptions {
  allowedMimeTypes?: string[]
  fileSizeLimit?: number
}

// One provisioning attempt per bucket per server process.
const ready = new Map<string, Promise<void>>()

/**
 * Make sure a public Supabase Storage bucket exists before uploading to it.
 *
 * Buckets aren't part of the Prisma schema, so a fresh Supabase project (or
 * one where a bucket was never created by hand) fails every upload with
 * "Bucket not found". Creating on first use keeps dev and prod in step the
 * same way migrations do for tables. Existing buckets are left as they are.
 *
 * Needs the service-role client — anon keys can't list or create buckets.
 */
export function ensurePublicBucket(
  supabase: SupabaseClient,
  name: string,
  options: PublicBucketOptions = {},
): Promise<void> {
  let pending = ready.get(name)
  if (!pending) {
    pending = (async () => {
      const { data, error: listError } = await supabase.storage.listBuckets()
      if (listError) throw listError
      if (data?.some((b) => b.name === name)) return
      const { error: createError } = await supabase.storage.createBucket(name, {
        public: true,
        ...(options.allowedMimeTypes ? { allowedMimeTypes: options.allowedMimeTypes } : {}),
        ...(options.fileSizeLimit ? { fileSizeLimit: options.fileSizeLimit } : {}),
      })
      if (createError && !createError.message.toLowerCase().includes('already exists')) {
        throw createError
      }
      console.log(`[storage] Provisioned Supabase bucket '${name}'`)
    })().catch((err) => {
      // Forget the failure so a later request can retry.
      ready.delete(name)
      throw err
    })
    ready.set(name, pending)
  }
  return pending
}

/** Test hook: clear the per-process cache. */
export function resetEnsuredBuckets(): void {
  ready.clear()
}
