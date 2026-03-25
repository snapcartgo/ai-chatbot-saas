"use client";

import { useEffect } from "react";
import Link from "next/link"; // ✅ New: Optimized navigation
import { useSearchParams } from "next/navigation"; // ✅ New: Referral detection
import ChatWidget from "./components/ChatWidget";

export default function Home() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  // ✅ New: Referral Tracking Logic
  useEffect(() => {
    if (ref) {
      console.log("Referral detected and saved:", ref);
      localStorage.setItem("referral", ref);
    }
  }, [ref]);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      
      {/* Navbar - Restored Original Style */}
      <nav className="flex justify-between items-center px-8 py-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-blue-500">AI Chatbot SaaS</h1>

        <div className="space-x-6">
          <Link href="/login" className="text-gray-300 hover:text-white">
            Login
          </Link>

          {/* ✅ Fixed: Using Link + carrying ref if it exists */}
          <Link 
            href={ref ? `/signup?ref=${ref}` : "/signup"} 
            className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero Section - Restored Original Style */}
      <section className="text-center py-24 px-6">
        <h2 className="text-5xl font-bold mb-6 leading-tight">
          Automate Customer Conversations with AI
        </h2>

        <p className="text-gray-400 max-w-xl mx-auto mb-10 text-lg">
          Build AI chatbots that capture leads, answer questions, and
          automatically book appointments for your business.
        </p>

        <div className="flex justify-center space-x-4">
          <Link
            href={ref ? `/signup?ref=${ref}` : "/signup"}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition"
          >
            Start Free Trial
          </Link>

          <Link
            href="/dashboard"
            className="border border-gray-600 hover:bg-gray-800 px-6 py-3 rounded-lg transition"
          >
            View Dashboard
          </Link>
        </div>
      </section>

      {/* Features Section - Restored Original 3-Column Grid */}
      <section className="grid md:grid-cols-3 gap-8 px-10 pb-24 max-w-6xl mx-auto">
        
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 hover:border-blue-500/50 transition">
          <h3 className="text-xl font-semibold mb-3 text-blue-400">
            AI Chatbot
          </h3>
          <p className="text-gray-400 leading-relaxed">
            Automatically respond to customer queries using AI.
          </p>
        </div>

        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 hover:border-blue-500/50 transition">
          <h3 className="text-xl font-semibold mb-3 text-blue-400">
            Lead Capture
          </h3>
          <p className="text-gray-400 leading-relaxed">
            Capture leads and customer details automatically.
          </p>
        </div>

        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 hover:border-blue-500/50 transition">
          <h3 className="text-xl font-semibold mb-3 text-blue-400">
            Booking Automation
          </h3>
          <p className="text-gray-400 leading-relaxed">
            Let customers schedule appointments directly from the chatbot.
          </p>
        </div>

      </section>

      <ChatWidget />

    </main>
  );
}