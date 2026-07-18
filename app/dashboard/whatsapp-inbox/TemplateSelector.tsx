'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Template {
  template_name: string;
  language: string;
  status: string;
}

export default function TemplateSelector({ recipientPhone }: { recipientPhone: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [sending, setSending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function getApprovedTemplates() {
      const { data } = await supabase
        .from('whatsapp_templates')
        .select('template_name, language, status')
        .eq('status', 'APPROVED');
      if (data) setTemplates(data);
    }
    getApprovedTemplates();
  }, []);

  const handleSend = async () => {
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
      if (res.ok) {
        alert('Template sent successfully!');
        setIsOpen(false);
      } else {
        const err = await res.json();
        alert(`Error sending: ${err.error}`);
      }
    } catch (e) {
      alert('Network transmission failure.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition"
      >
        ⚡ Send Template
      </button>

      {isOpen && (
        <div className="absolute bottom-12 left-0 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
          <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Select Approved Template</p>
          <select 
            className="w-full p-2 bg-slate-800 text-white text-sm border border-slate-700 rounded mb-3 focus:outline-none"
            onChange={(e) => {
              const item = templates.find(t => t.template_name === e.target.value);
              setSelectedTemplate(item || null);
            }}
            defaultValue=""
          >
            <option value="" disabled>-- Choose Template --</option>
            {templates.map(t => (
              <option key={t.template_name} value={t.template_name}>
                {t.template_name} ({t.language})
              </option>
            ))}
          </select>

          {selectedTemplate && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full py-1.5 text-center bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm rounded font-medium transition"
            >
              {sending ? 'Sending...' : 'Confirm Send'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}