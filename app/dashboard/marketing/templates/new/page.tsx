import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { TemplateForm } from '../../../../components/marketing/template-form';

export const dynamic = 'force-dynamic';

export default async function NewTemplatePage() {
  // 1. Initialize Supabase SSR Client properly inside the async function
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
            // The `setAll` method can be ignored if called from a Server Component
          }
        },
      },
    }
  );

  // 2. Fetch the first active WhatsApp configuration
  const { data: config, error } = await supabase
    .from('whatsapp_configs')
    .select('id')
    .limit(1)
    .single();

  if (error || !config) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 font-medium">No WhatsApp configuration found.</p>
        <p className="text-sm text-gray-500 mt-1">
          Please configure your WhatsApp API details first before creating templates.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="mb-4">
        <Link
          href="/dashboard/marketing/templates"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" /> Back to templates
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Meta Template</h1>
        <p className="text-sm text-gray-500 mb-6">
          Submit template formatting setups. Meta standard validation takes from 2 minutes up to 24 hours.
        </p>
      </div>

      <TemplateForm whatsappConfigId={config.id} />
    </div>
  );
}