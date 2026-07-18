'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Setup basic public client connection
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Template {
  template_name: string;
  category: string;
  language: string;
  status: string;
}

export default function TemplateSelector({ recipientPhone }: { recipientPhone: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [sending, setSending] = useState(false);

  // Load ONLY approved templates from Supabase
  useEffect(() => {
    async function loadTemplates() {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('status', 'APPROVED'); // Only let agents send verified templates

      if (data) setTemplates(data);
    }
    loadTemplates();
  }, []);

  const handleSendTemplate = async () => {
    if (!selectedTemplate || !recipientPhone) return;
    setSending(true);

    try {
      const res = await fetch('/api/whatsapp/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: selectedTemplate.template_name,
          languageCode: selectedTemplate.language,
          recipientPhone: recipientPhone,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Template "${selectedTemplate.template_name}" sent successfully!`);
        setSelectedTemplate(null);
      } else {
        alert(`Failed to send: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error trying to transmit template.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 border border-slate-700 bg-slate-900 rounded-lg max-w-sm">
      <label className="block text-sm font-medium text-slate-300 mb-2">
        Send WhatsApp Template
      </label>
      
      <select
        className="w-full p-2 bg-slate-800 text-white border border-slate-600 rounded mb-4 focus:outline-none"
        onChange={(e) => {
          const found = templates.find(t => t.template_name === e.target.value);
          setSelectedTemplate(found || null);
        }}
        defaultValue=""
      >
        <option value="" disabled>-- Choose an Approved Template --</option>
        {templates.map((tmpl) => (
          <option key={tmpl.template_name} value={tmpl.template_name}>
            {tmpl.template_name} ({tmpl.language})
          </option>
        ))}
      </select>

      {selectedTemplate && (
        <button
          onClick={handleSendTemplate}
          disabled={sending}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded transition"
        >
          {sending ? 'Sending...' : `Send to ${recipientPhone}`}
        </button>
      )}
    </div>
  );
}