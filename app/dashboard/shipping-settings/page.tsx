'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function ShippingSettingsPage() {
  // Initialize the SSR-compliant browser client that reads auth cookies
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(false);
  const [botId, setBotId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [formData, setFormData] = useState({
    shiprocket_email: '',
    shiprocket_password: '',
    shiprocket_pickup_location: 'Primary',
  });
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocalhost ? 'https://woodpetra.in' : window.location.origin;
      setWebhookUrl(`${baseUrl}/api/shipping-webhook`);
    }

    async function loadSettings() {
      // 1. Get authenticated user from cookie session
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 2. Fetch chatbot ID
      const { data: bot } = await supabase
        .from('chatbots')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (bot) {
        setBotId(bot.id);
      }

      // 3. Fetch existing shipping configuration
      const { data: shippingConfig } = await supabase
        .from('shipping_configs')
        .select('shiprocket_email, shiprocket_password, shiprocket_pickup_location')
        .eq('user_id', user.id)
        .maybeSingle();

      if (shippingConfig) {
        setFormData({
          shiprocket_email: shippingConfig.shiprocket_email || '',
          shiprocket_password: shippingConfig.shiprocket_password || '',
          shiprocket_pickup_location: shippingConfig.shiprocket_pickup_location || 'Primary',
        });
      }
    }

    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setStatusMessage(null);

    // 1. Verify user authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setStatusMessage({ type: 'error', text: 'You must be logged in to save settings.' });
      return;
    }

    // 2. Save/Upsert into shipping_configs table
    const { error } = await supabase
      .from('shipping_configs')
      .upsert(
        {
          user_id: user.id,
          bot_id: botId,
          shiprocket_email: formData.shiprocket_email.trim(),
          shiprocket_password: formData.shiprocket_password.trim(),
          shiprocket_pickup_location: formData.shiprocket_pickup_location.trim() || 'Primary',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    setLoading(false);

    if (error) {
      setStatusMessage({ type: 'error', text: 'Failed to update shipping settings: ' + error.message });
    } else {
      setStatusMessage({ type: 'success', text: 'Shipping & Shiprocket credentials saved successfully!' });
    }
  };

  const handleCopy = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Shipping & COD Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect your Shiprocket account to automate Cash on Delivery (COD) order fulfillment and shipping labels.
      </p>

      {statusMessage && (
        <div
          className={`p-4 rounded-lg mb-6 text-sm ${
            statusMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Shiprocket Email ID
            </label>
            <input
              type="email"
              autoComplete="off"
              placeholder="merchant@example.com"
              value={formData.shiprocket_email}
              onChange={(e) => setFormData({ ...formData, shiprocket_email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Shiprocket Password / API Key
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              value={formData.shiprocket_password}
              onChange={(e) => setFormData({ ...formData, shiprocket_password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Pickup Location Name
            </label>
            <input
              type="text"
              autoComplete="off"
              placeholder="Primary"
              value={formData.shiprocket_pickup_location}
              onChange={(e) => setFormData({ ...formData, shiprocket_pickup_location: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Must match the exact pickup address nickname configured in your Shiprocket account settings.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Shiprocket Webhook Setup</h2>
        <p className="text-sm text-gray-500 mb-4">
          Add this webhook URL into your Shiprocket account so real-time delivery status updates and COD collections sync directly to your dashboard.
        </p>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 flex items-center justify-between">
          <code className="text-sm text-blue-600 font-mono break-all mr-3">
            {webhookUrl || 'https://woodpetra.in/api/shipping-webhook'}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-md transition shrink-0"
          >
            {copied ? 'Copied!' : 'Copy URL'}
          </button>
        </div>

        <div className="text-sm text-gray-600 space-y-2">
          <p className="font-semibold text-gray-700">How to configure:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Log in to your <b>Shiprocket Dashboard</b>.</li>
            <li>Go to <b>Settings &rarr; Additional Settings &rarr; Webhooks</b>.</li>
            <li>Make sure the <b>Webhook Connection</b> toggle is turned <b>ENABLED</b>.</li>
            <li>Paste the copied URL into the <b>URL</b> field.</li>
            <li>Set <b>Auth Token Type</b> to <code>x-api-key</code> (or None).</li>
            <li>Click <b>Save</b>, then click <b>Test Webhook</b> to verify the connection.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}