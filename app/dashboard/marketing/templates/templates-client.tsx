'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TemplatesTable, Template } from '../../../components/marketing/templates-table';

interface TemplatesClientProps {
  initialTemplates: Template[];
}

export function TemplatesClient({ initialTemplates }: TemplatesClientProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Fetch current user email for the Laravel redirect autofill
  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email.toLowerCase());
      }
    }
    getUser();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      const response = await fetch('/api/sync-templates', {
        method: 'POST',
      });

      const result = await response.json();

      console.log('Backend Response:', result);

      if (!response.ok) {
        alert(JSON.stringify(result, null, 2));
        return;
      }

      alert('Sync successful');
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Function that opens Laravel and pre-fills the email field
  const handleLaravelRedirectAndFill = (e: React.MouseEvent) => {
    e.preventDefault();

    const targetUrl = 'https://marketing.woodpetra.in/auth/register/vendor';
    const newWindow = window.open(targetUrl, '_blank');

    if (newWindow && userEmail) {
      const checkInterval = setInterval(() => {
        try {
          if (
            newWindow.document &&
            newWindow.document.readyState === 'complete'
          ) {
            const emailInput =
              (newWindow.document.getElementById('email') as HTMLInputElement) ||
              (newWindow.document.querySelector(
                'input[name="email"]'
              ) as HTMLInputElement);

            if (emailInput) {
              emailInput.value = userEmail;
              emailInput.dispatchEvent(new Event('input', { bubbles: true }));
              clearInterval(checkInterval);
            }
          }
        } catch (error) {
          clearInterval(checkInterval);
        }
      }, 500);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 1. Top Section: WhatsApp Marketing / Bot Banner */}
      <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-950 via-emerald-900 to-lime-900 shadow-2xl shadow-emerald-950/20">
        <div className="flex flex-col gap-6 px-6 py-7 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-200">
              WhatsApp Marketing
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">
              WhatsApp Bot
            </h2>
            <p className="mt-3 text-sm leading-6 text-emerald-100/85 md:text-base">
              Open your WhatsApp bot dashboard to manage campaigns, templates,
              bot replies, contacts, and automations from one place.
            </p>
          </div>

          <button
            onClick={handleLaravelRedirectAndFill}
            className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-sm font-bold text-emerald-950 shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-xl"
          >
            WhatsApp Bot
          </button>
        </div>
      </div>

      {/* 2. Middle Section: WhatsApp Templates Header & Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-black">
            WhatsApp Templates
          </h1>
          <p className="text-sm text-gray-500">
            Manage and coordinate pre-approved message layouts for Meta compliance rules.
          </p>
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
      </div>

      {/* 3. Bottom Section: Templates Table */}
      <TemplatesTable templates={initialTemplates} />
    </div>
  );
}