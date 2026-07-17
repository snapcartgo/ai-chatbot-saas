import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { StatusBadge } from '../../../../components/marketing/status-badge';

export const dynamic = 'force-dynamic';

interface TemplateDetailPageProps {
  params: Promise<{ templateId: string }>;
}

export default async function TemplateDetailPage({ params }: TemplateDetailPageProps) {
  const { templateId } = await params;
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
            // Safe to ignore
          }
        },
      },
    }
  );

  // Fetch the specific template data
  const { data: template } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (!template) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Template not found.</p>
        <Link href="/dashboard/marketing/templates" className="text-blue-600 hover:underline mt-2 inline-block">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4 bg-transparent">
  <Link href="/dashboard/marketing/templates" className="p-2 border rounded-md border-gray-200 dark:border-gray-700 hover:bg-gray-55 text-gray-700 dark:text-gray-300">
    <ArrowLeft className="w-4 h-4" />
  </Link>
  <div>
    <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white block" style={{ color: '#111827' }}>
      {template.name}
    </h1>
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Template overview and live settings configuration.
    </p>
  </div>
</div>

      <div className="bg-white dark:bg-gray-900 border rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
        <div className="p-6 grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-gray-400 block uppercase font-medium">Category</span>
            <span className="text-sm font-medium capitalize text-gray-900 dark:text-white">{template.category.toLowerCase()}</span>
          </div>
          <div>
            <span className="text-xs text-gray-400 block uppercase font-medium">Status</span>
            <div className="mt-1">
              <StatusBadge status={template.status} />
            </div>
          </div>
        </div>

        <div className="p-6">
          <span className="text-xs text-gray-400 block uppercase font-medium mb-2">Message Body</span>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border rounded-lg font-mono text-sm whitespace-pre-wrap text-gray-850 dark:text-gray-200">
            {template.body}
          </div>
        </div>

        {template.footer && (
          <div className="p-6">
            <span className="text-xs text-gray-400 block uppercase font-medium mb-1">Footer</span>
            <span className="text-sm text-gray-500">{template.footer}</span>
          </div>
        )}
      </div>
    </div>
  );
}