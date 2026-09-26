import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensurePublicBucket, resetEnsuredBuckets } from '@/lib/storage-buckets'

function client(existing: string[], createError: { message: string } | null = null) {
  const createBucket = vi.fn(async () => ({ data: null, error: createError }))
  const listBuckets = vi.fn(async () => ({
    data: existing.map((name) => ({ name })),
    error: null,
  }))
  return {
    supabase: { storage: { listBuckets, createBucket } } as unknown as SupabaseClient,
    createBucket,
    listBuckets,
  }
}

beforeEach(() => resetEnsuredBuckets())

describe('ensurePublicBucket', () => {
  it('creates a missing bucket as public', async () => {
    const { supabase, createBucket } = client(['logos'])
    await ensurePublicBucket(supabase, 'tournament-photos', { fileSizeLimit: 10 })
    expect(createBucket).toHaveBeenCalledWith('tournament-photos', { public: true, fileSizeLimit: 10 })
  })

  it('leaves an existing bucket alone', async () => {
    const { supabase, createBucket } = client(['tournament-photos'])
    await ensurePublicBucket(supabase, 'tournament-photos')
    expect(createBucket).not.toHaveBeenCalled()
  })

  it('only checks once per bucket per process', async () => {
    const { supabase, listBuckets } = client(['a'])
    await ensurePublicBucket(supabase, 'a')
    await ensurePublicBucket(supabase, 'a')
    expect(listBuckets).toHaveBeenCalledTimes(1)
  })

  it('tolerates a create race ("already exists")', async () => {
    const { supabase } = client([], { message: 'The resource already exists' })
    await expect(ensurePublicBucket(supabase, 'x')).resolves.toBeUndefined()
  })

  it('retries after a failure', async () => {
    const { supabase, listBuckets } = client([], { message: 'permission denied' })
    await expect(ensurePublicBucket(supabase, 'x')).rejects.toBeTruthy()
    await expect(ensurePublicBucket(supabase, 'x')).rejects.toBeTruthy()
    expect(listBuckets).toHaveBeenCalledTimes(2)
  })
})
