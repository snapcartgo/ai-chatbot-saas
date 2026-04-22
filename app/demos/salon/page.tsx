"use client";

import ChatWidget from "@/app/components/ChatWidget";

export default function SalonDemo() {
  return (
    <div className="min-h-screen bg-black text-white">

      {/* HERO */}
      <section className="p-10 max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">
          AI Chatbot for Salons & Clinics
        </h1>

        <p className="text-gray-400 mb-6">
          Book appointments, answer customer questions, and grow your business automatically.
        </p>

        <button
          onClick={() => (window.location.href = "/signup")}
          className="bg-blue-600 px-6 py-3 rounded-lg font-semibold"
        >
          Start Free Trial
        </button>
      </section>

      {/* CHAT DEMO */}
      <section className="max-w-4xl mx-auto p-6">
        <div className="bg-gray-900 rounded-xl p-4">
          <ChatWidget chatbotId="salon-demo" isEmbed />
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto p-10 grid md:grid-cols-3 gap-6">
        <div>💇 Book appointments</div>
        <div>💬 Answer customer queries</div>
        <div>📈 Increase bookings</div>
      </section>

    </div>
  );
}