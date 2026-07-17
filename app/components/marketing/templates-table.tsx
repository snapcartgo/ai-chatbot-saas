import React from 'react';
import Link from 'next/link';
import { Eye, Trash2 } from 'lucide-react';
import { StatusBadge } from './status-badge';

export interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  updated_at: string;
}

interface TemplatesTableProps {
  templates: Template[];
  onDelete?: (id: string) => void; // Added a "?" here to make it optional
}

export function TemplatesTable({ templates, onDelete }: TemplatesTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 text-left font-medium text-gray-500 dark:text-gray-400">
          <tr>
            <th className="px-6 py-3">Template Name</th>
            <th className="px-6 py-3">Category</th>
            <th className="px-6 py-3">Language</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">Last Updated</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 dark:text-gray-300">
          {templates.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                No templates found. Create your first one to get started!
              </td>
            </tr>
          ) : (
            templates.map((template) => (
              <tr key={template.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{template.name}</td>
                <td className="px-6 py-4 capitalize">{template.category.toLowerCase()}</td>
                <td className="px-6 py-4 uppercase">{template.language}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={template.status} />
                </td>
                <td className="px-6 py-4">{new Date(template.updated_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right space-x-2">
                  <Link href={`/dashboard/marketing/templates/${template.id}`} className="inline-flex p-1.5 text-gray-500 hover:text-blue-600">
                    <Eye className="w-4 h-4" />
                  </Link>
                  <button 
  onClick={() => {
    if (onDelete) {
      onDelete(template.id);
    } else {
      // Internal deletion logic fallback if no server prop is passed
      if (confirm('Are you sure you want to delete this template?')) {
        fetch(`/api/templates/${template.id}`, { method: 'DELETE' })
          .then(res => res.ok && window.location.reload());
      }
    }
  }} 
  className="inline-flex p-1.5 text-gray-500 hover:text-red-600"
>
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}