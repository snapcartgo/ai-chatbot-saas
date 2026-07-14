// app/dashboard/products/sync-meta/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from "@/lib/supabase";

interface SyncResult {
  imported: number;
  updated: number;
  total: number;
}

export default function SyncMetaPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [catalogId, setCatalogId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [saveToDb, setSaveToDb] = useState(true);

  // Status & Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Get current logged-in user
  useEffect(() => {
    async function getUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          setApiError(null);
        } else {
          setApiError('User session not found.');
        }
      } catch (err) {
        setApiError('Authentication failed. Please log in again.');
      }
    }
    getUser();
  }, []);

  // Toast auto-dismissal
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return setApiError('User session not found.');
    if (!catalogId || !accessToken) return setApiError('Please fill in both credential fields.');

    setIsSaving(true);
    setApiError(null);

    try {
      const res = await fetch('/api/save-meta-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          meta_catalog_id: catalogId,
          meta_access_token: accessToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to save configuration.');

      setToast({ type: 'success', message: 'Credentials updated successfully!' });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
      setApiError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncProducts = async () => {
    if (!userId) return setApiError('User session not found.');

    setIsSyncing(true);
    setApiError(null);
    setSyncResult(null);

    try {
      const res = await fetch('/api/sync-meta-products', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Product synchronization failed.');

      setSyncResult({
        imported: data.imported ?? 0,
        updated: data.updated ?? 0,
        total: data.total ?? 0,
      });
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-md p-4 shadow-lg transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      <nav className="mb-6">
        <Link href="/dashboard/products" className="text-sm font-medium text-blue-600 hover:text-blue-500">
          &larr; Back to Products
        </Link>
      </nav>

      <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sync Meta Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure your Facebook Business Catalog credentials to pull live assets directly into your store.
          </p>
        </div>

        <hr className="border-slate-200" />

        <form onSubmit={handleSaveCredentials} className="space-y-4">
          <div>
            <label htmlFor="catalogId" className="block text-sm font-medium text-slate-700">
              Meta Catalog ID
            </label>
            <input
              type="text"
              id="catalogId"
              value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., 4719947504907117"
              disabled={isSaving || isSyncing}
            />
          </div>

          <div>
            <label htmlFor="accessToken" className="block text-sm font-medium text-slate-700">
              Meta Access Token
            </label>
            <input
              type="password"
              id="accessToken"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••••••••••••••"
              disabled={isSaving || isSyncing}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="saveDb"
              checked={saveToDb}
              onChange={(e) => setSaveToDb(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              disabled={isSaving || isSyncing}
            />
            <label htmlFor="saveDb" className="ml-2 block text-sm text-slate-700 select-none">
              Save credentials for future syncs
            </label>
          </div>

          <button
            type="submit"
            disabled={isSaving || isSyncing || !saveToDb || !userId}
            className="w-full sm:w-auto inline-flex justify-center rounded-xl bg-slate-900 px-5 py-3 font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Credentials'}
          </button>
        </form>

        <hr className="border-slate-200" />

        <div className="pt-2">
          <button
            type="button"
            onClick={handleSyncProducts}
            disabled={isSyncing || isSaving || !userId}
            className="w-full inline-flex justify-center rounded-xl bg-blue-600 px-5 py-3.5 font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {isSyncing ? 'Syncing...' : 'Sync Products'}
          </button>
        </div>

        <hr className="border-slate-200" />

        <div className="space-y-4">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-[0.25em]">Status box</h2>

          {apiError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-sm text-rose-800 font-medium">
                {apiError}
              </div>
            </div>
          )}

          {!apiError && !syncResult && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center text-sm text-slate-500">
              {isSyncing ? 'Sync in progress...' : isSaving ? 'Saving...' : 'System Idle. Awaiting sync initialization.'}
            </div>
          )}

          {syncResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
              <h3 className="text-sm font-semibold text-emerald-900 mb-3">✓ Catalog Synchronized Successfully</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-xl bg-white p-3 border border-emerald-100 shadow-sm">
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Imported</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900">{syncResult.imported}</p>
                </div>
                <div className="rounded-xl bg-white p-3 border border-emerald-100 shadow-sm">
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Updated</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900">{syncResult.updated}</p>
                </div>
                <div className="rounded-xl bg-white p-3 border border-emerald-100 shadow-sm">
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Total Items</p>
                  <p className="mt-1 text-xl font-extrabold text-blue-600">{syncResult.total}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}