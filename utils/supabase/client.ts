import { createBrowserClient } from '@supabase/ssr'

// The 'export' keyword is critical for the Vercel build to pass
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )