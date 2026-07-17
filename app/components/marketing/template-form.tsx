'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

interface TemplateFormProps {
  whatsappConfigId: string;
}

export function TemplateForm({ whatsappConfigId }: TemplateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'UTILITY',
    language: 'en',
    header_type: 'NONE',
    header_content: '',
    body: '',
    footer: '',
  });
  
  const [buttons, setButtons] = useState<any[]>([]);

  const addButton = () => {
    if (buttons.length >= 3) return; 
    setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }]);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleButtonTextChange = (index: number, text: string) => {
    const updated = [...buttons];
    updated[index].text = text;
    setButtons(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          buttons, 
          whatsapp_config_id: whatsappConfigId 
        }),
      });

      if (res.ok) {
        router.push('/dashboard/marketing/templates');
        router.refresh();
      } else {
        alert('Failed to save template');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-250 dark:border-gray-800">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Template Name</label>
          <input 
            type="text" 
            required 
            placeholder="e.g., order_confirmation"
            className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Category</label>
          <select 
            className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
            value={formData.category}
            onChange={e => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="UTILITY">Utility</option>
            <option value="MARKETING">Marketing</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Header (Optional)</label>
        <select 
          className="w-full p-2 border rounded-md mb-2 dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
          value={formData.header_type}
          onChange={e => setFormData({ ...formData, header_type: e.target.value, header_content: '' })}
        >
          <option value="NONE">None</option>
          <option value="TEXT">Text Header</option>
        </select>
        {formData.header_type === 'TEXT' && (
          <input 
            type="text" 
            maxLength={60}
            placeholder="Enter header text..."
            className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
            value={formData.header_content}
            onChange={e => setFormData({ ...formData, header_content: e.target.value })}
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Body Message</label>
        <textarea 
          required 
          rows={5}
          placeholder="Hello {{1}}, your order {{2}} has been shipped!"
          className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
          value={formData.body}
          onChange={e => setFormData({ ...formData, body: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">Use numbers wrapped in double curly braces like {"{{1}}"} for variable fields.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Footer Text (Optional)</label>
        <input 
          type="text" 
          maxLength={60}
          placeholder="Not interested? Reply STOP"
          className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
          value={formData.footer}
          onChange={e => setFormData({ ...formData, footer: e.target.value })}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Interactive Buttons</label>
          {buttons.length < 3 && (
            <button type="button" onClick={addButton} className="text-xs flex items-center gap-1 text-blue-600 hover:underline">
              <Plus className="w-3 h-3" /> Add Quick Reply
            </button>
          )}
        </div>
        <div className="space-y-2">
          {buttons.map((btn, index) => (
            <div key={index} className="flex items-center gap-2">
              <input 
                type="text" 
                required 
                placeholder="Button text (e.g., Track Order)"
                className="flex-1 p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
                value={btn.text}
                onChange={e => handleButtonTextChange(index, e.target.value)}
              />
              <button type="button" onClick={() => removeButton(index)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition disabled:opacity-50"
      >
        {loading ? 'Submitting to Meta...' : 'Save & Submit Template'}
      </button>
    </form>
  );
}