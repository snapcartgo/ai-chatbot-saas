"use client";

import ChatWidget from "@/app/components/ChatWidget"; // Ensure this path matches your file structure

export default function EcommerceDemo() {
  return (
    <div className="min-h-screen bg-[#020617] text-white p-6">
      {/* HEADER */}
      <div className="max-w-5xl mx-auto text-center mb-8">
        <h1 className="text-4xl font-bold">
          AI E-commerce Assistant Demo
        </h1>
        <p className="text-gray-400 mt-2">
          Increase sales, automate support, and recommend products instantly.
        </p>
      </div>

      {/* FEATURES - Visual benefits for your agency clients */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="p-4 bg-[#0f172a] rounded-xl border border-slate-800 text-center">
          🛍️ Product Recommendations
        </div>
        <div className="p-4 bg-[#0f172a] rounded-xl border border-slate-800 text-center">
          💬 Instant Customer Support
        </div>
        <div className="p-4 bg-[#0f172a] rounded-xl border border-slate-800 text-center">
          💰 Upsell & Cross-sell
        </div>
      </div>

      {/* CHAT UI - Now using your real n8n backend */}
      <div className="max-w-4xl mx-auto bg-[#0f172a] rounded-3xl p-2 shadow-2xl border-8 border-slate-900">
        <div className="rounded-2xl overflow-hidden bg-white">
          <ChatWidget 
            chatbotId="d0a5a66a-4994-4a59-8d09-fd251e11b033" 
            niche="ecommerce"
            isEmbed
          />
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-10">
        <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 transition-colors font-bold rounded-xl shadow-lg">
          Get This AI for Your Store
        </button>
        <p className="text-slate-500 mt-4 text-sm">
          Powered by your AI Automation Agency
        </p>
      </div>
    </div>
  );
}