"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChatWidget from "./components/ChatWidget";

export default function HomeClient() {
  const [ref, setRef] = useState<string | null>(null);

  // ✅ Referral tracking (browser only)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refValue = params.get("ref");

    if (refValue) {
      console.log("Referral detected and saved:", refValue);
      localStorage.setItem("referral", refValue);
      setRef(refValue);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      
      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-blue-500">AI Chatbot SaaS</h1>

        <div className="space-x-6">
          <Link href="/login" className="text-gray-300 hover:text-white">
            Login
          </Link>

          <Link 
            href={ref ? `/signup?ref=${ref}` : "/signup"} 
            className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="text-center py-24 px-6">
        
        {/* 🔥 Headline */}
        <h2 className="text-5xl font-bold mb-6 leading-tight">
          Automate Your Business with AI
        </h2>

        {/* 🔥 Sub-headline */}
        <p className="text-xl text-gray-300 mb-3">
          AI Chatbot That Actually Brings You Customers
        </p>

        {/* 🔥 Description */}
        <p className="text-gray-400 max-w-xl mx-auto mb-10 text-lg">
          Capture every visitor, follow up automatically, and convert them into 
          paying customers — all on autopilot.
        </p>

        {/* Buttons */}
        <div className="flex justify-center space-x-4">
          <Link
            href={ref ? `/signup?ref=${ref}` : "/signup"}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
          >
            Start Free
          </Link>

          <Link
            href="/dashboard"
            className="border border-gray-600 hover:bg-gray-800 px-6 py-3 rounded-lg"
          >
            Go to Dashboard
          </Link>
        </div>

        {/* 🔥 Trust / USP Line */}
        <p className="mt-8 text-gray-500 text-sm">
          No coding required • Setup in 2 minutes • Start free
        </p>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-8 px-10 pb-16 max-w-6xl mx-auto">
        
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 hover:border-blue-500 transition">
          <h3 className="text-xl font-semibold mb-3 text-blue-400">
            AI Chatbot
          </h3>
          <p className="text-gray-400">
            Instantly respond to visitors and answer their questions automatically using AI.
          </p>
        </div>

        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 hover:border-blue-500 transition">
          <h3 className="text-xl font-semibold mb-3 text-blue-400">
            Lead Capture
          </h3>
          <p className="text-gray-400">
            Capture every visitor as a potential customer and store their details automatically.
          </p>
        </div>

        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 hover:border-blue-500 transition">
          <h3 className="text-xl font-semibold mb-3 text-blue-400">
            Booking Automation
          </h3>
          <p className="text-gray-400">
            Let users book appointments or services without any manual effort.
          </p>
        </div>

      </section>

      {/* 🔥 BIG DIFFERENTIATOR LINE */}
      <div className="text-center pb-20 px-6">
        <p className="text-xl font-semibold text-white">
          Most chatbots just reply. Ours converts visitors into customers.
        </p>
      </div>

      {/* Chat Widget */}
      <ChatWidget />

    </main>
  );
}