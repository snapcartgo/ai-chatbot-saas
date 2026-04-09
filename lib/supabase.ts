import { createBrowserClient } from '@supabase/ssr';

// This is the "Safe" version that looks exactly like your original to the rest of your app
const supabaseClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const supabase = supabaseClient;