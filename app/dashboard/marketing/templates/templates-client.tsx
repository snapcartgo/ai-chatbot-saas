'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';
import { TemplatesTable, Template } from '../../../components/marketing/templates-table';

interface TemplatesClientProps {
  initialTemplates: Template[];
}

export function TemplatesClient({ initialTemplates }: TemplatesClientProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
  setIsSyncing(true);

  try {
    const response = await fetch("/api/sync-templates", {
      method: "POST",
    });

    const result = await response.json();

    console.log("Backend Response:", result);

    if (!response.ok) {
      alert(JSON.stringify(result, null, 2));
      return;
    }

    alert("Sync successful");
    window.location.reload();

  } catch (err) {
    console.error(err);
  } finally {
    setIsSyncing(false);
  }
};

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">WhatsApp Templates</h1>
          <p className="text-sm text-gray-500">Manage and coordinate pre-approved message layouts for Meta compliance rules.</p>
        </div>
        
        {/* --- Action Buttons Container --- */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-gray-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync from Meta'}
          </button>

          <Link 
            href="/dashboard/marketing/templates/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" /> New Template
          </Link>
        </div>
        {/* --------------------------------- */}
      </div>

      <TemplatesTable templates={initialTemplates} />
    </div>
  );
}