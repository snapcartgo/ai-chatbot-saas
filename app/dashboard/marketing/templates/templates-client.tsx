'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { TemplatesTable, Template } from '../../../components/marketing/templates-table';

interface TemplatesClientProps {
  initialTemplates: Template[];
}

export function TemplatesClient({ initialTemplates }: TemplatesClientProps) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">WhatsApp Templates</h1>
          <p className="text-sm text-gray-500">Manage and coordinate pre-approved message layouts for Meta compliance rules.</p>
        </div>
        <Link 
          href="/dashboard/marketing/templates/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" /> New Template
        </Link>
      </div>

      <TemplatesTable templates={initialTemplates} />
    </div>
  );
}