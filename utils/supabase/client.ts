import { createBrowserClient } from '@supabase/ssr'

// The 'export' keyword here is critical for the build to succeed
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}