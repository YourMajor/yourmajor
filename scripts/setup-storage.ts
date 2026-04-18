import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function setupStorage() {
  const buckets = [
    { name: 'logos', public: true },
    { name: 'avatars', public: true },
  ]

  for (const bucket of buckets) {
    const { data, error } = await supabaseAdmin.storage.createBucket(bucket.name, {
      public: bucket.public,
    })

    if (error && error.message !== 'The resource already exists') {
      console.error(`Failed to create bucket "${bucket.name}":`, error.message)
    } else {
      console.log(`Bucket "${bucket.name}" ready.`)
    }
  }
}

setupStorage()
