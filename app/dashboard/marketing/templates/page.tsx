import React from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { TemplatesClient } from './templates-client';

export const dynamic = 'force-dynamic';

export default async function TemplatesDashboardPage() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe to ignore inside Server Components
          }
        },
      },
    }
  );
  
  const { data: templates } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .order('created_at', { ascending: false });

  // Pass data to a designated client component wrapper
  return <TemplatesClient initialTemplates={(templates || []) as any} />;
}