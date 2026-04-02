"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChatWidget from "./components/ChatWidget";

export default function HomeClient() {
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refValue = params.get("ref");

    if (refValue) {
      localStorage.setItem("referral", refValue);
      setRef(refValue);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* 🔥 NAVBAR */}
      <nav className="flex flex-col md:flex-row justify-between items-center px-4 md:px-8 py-4 border-b border-gray-800 gap-3">

        <h1 className="text-lg md:text-xl font-bold text-blue-500">
          AI Chatbot SaaS
        </h1>

        <div className="flex gap-3 md:gap-6">
          <Link href="/login" className="text-sm md:text-base text-gray-300 hover:text-white">
            Login
          </Link>

          <Link
            href={ref ? `/signup?ref=${ref}` : "/signup"}
            className="bg-blue-600 px-3 py-2 md:px-4 md:py-2 rounded-lg text-sm md:text-base"
          >
            Start Free
          </Link>
        </div>

      </nav>

      {/* 🔥 HERO */}
      <section className="text-center py-16 md:py-24 px-4 md:px-6">

        <h2 className="text-2xl md:text-5xl font-bold mb-4 md:mb-6 leading-tight">
          Automate Your Business with AI
        </h2>

        <p className="text-sm md:text-xl text-gray-300 mb-2">
          AI Chatbot That Actually Brings You Customers
        </p>

        <p className="text-gray-400 max-w-md md:max-w-xl mx-auto mb-6 md:mb-10 text-sm md:text-lg">
          Capture every visitor, follow up automatically, and convert them into
          paying customers — all on autopilot.
        </p>

        {/* BUTTONS */}
        <div className="flex flex-col md:flex-row justify-center gap-3 md:gap-4">

          <Link
            href={ref ? `/signup?ref=${ref}` : "/signup"}
            className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-lg font-semibold text-sm md:text-base"
          >
            Start Free
          </Link>

          <Link
            href="/dashboard"
            className="border border-gray-600 hover:bg-gray-800 px-5 py-3 rounded-lg text-sm md:text-base"
          >
            Go to Dashboard
          </Link>

        </div>

        <p className="mt-6 text-gray-500 text-xs md:text-sm">
          No coding required • Setup in 2 minutes • Start free
        </p>

      </section>

      {/* 🔥 FEATURES */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 px-4 md:px-10 pb-12 md:pb-16 max-w-6xl mx-auto">

        <div className="bg-gray-900 p-5 md:p-8 rounded-xl border border-gray-800">
          <h3 className="text-lg md:text-xl font-semibold mb-2 text-blue-400">
            AI Chatbot
          </h3>
          <p className="text-gray-400 text-sm md:text-base">
            Instantly respond to visitors and answer their questions automatically using AI.
          </p>
        </div>

        <div className="bg-gray-900 p-5 md:p-8 rounded-xl border border-gray-800">
          <h3 className="text-lg md:text-xl font-semibold mb-2 text-blue-400">
            Lead Capture
          </h3>
          <p className="text-gray-400 text-sm md:text-base">
            Capture every visitor as a potential customer and store their details automatically.
          </p>
        </div>

        <div className="bg-gray-900 p-5 md:p-8 rounded-xl border border-gray-800">
          <h3 className="text-lg md:text-xl font-semibold mb-2 text-blue-400">
            Booking Automation
          </h3>
          <p className="text-gray-400 text-sm md:text-base">
            Let users book appointments or services without any manual effort.
          </p>
        </div>

      </section>

      {/* 🔥 USP */}
      <div className="text-center pb-12 md:pb-20 px-4">
        <p className="text-base md:text-xl font-semibold">
          Most chatbots just reply. Ours converts visitors into customers.
        </p>
      </div>

     

    </main>
  );
}
