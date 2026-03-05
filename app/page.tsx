"use client";

import ChatWidget from "./components/ChatWidget";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-800">

      {/* Navbar */}
      <nav className="flex justify-between items-center px-10 py-6 bg-white shadow">
        <h1 className="text-2xl font-bold text-blue-600">AI Chatbot SaaS</h1>

        <div className="space-x-6">
          <Link href="/login" className="text-gray-700 hover:text-blue-600">
            Login
          </Link>

          <Link
            href="/signup"
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="text-center py-24 px-6 max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-6 leading-tight">
          Automate Customer Conversations with AI
        </h1>

        <p className="text-lg text-gray-600 mb-10">
          Build powerful AI chatbots that capture leads, answer questions,
          and book appointments automatically.
        </p>

        <div className="flex justify-center gap-6">
          <Link
            href="/signup"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700"
          >
            Start Free Trial
          </Link>

          <Link
            href="/dashboard"
            className="border border-gray-400 px-8 py-3 rounded-lg text-lg hover:bg-gray-100"
          >
            View Dashboard
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-8 px-10 py-20 max-w-6xl mx-auto">
        <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
          <h3 className="text-xl font-bold mb-3">AI Chatbot</h3>
          <p className="text-gray-600">
            Automatically respond to customer queries using AI.
          </p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
          <h3 className="text-xl font-bold mb-3">Lead Capture</h3>
          <p className="text-gray-600">
            Capture leads and customer information automatically.
          </p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
          <h3 className="text-xl font-bold mb-3">Booking Automation</h3>
          <p className="text-gray-600">
            Let customers schedule appointments directly through the chatbot.
          </p>
        </div>
      </section>

      {/* Demo Section */}
      <section className="text-center py-20 bg-white">
        <h2 className="text-3xl font-bold mb-4">Try the AI Chatbot Demo</h2>

        <p className="text-gray-600 mb-10">
          Experience how the chatbot interacts with your visitors.
        </p>

        <div className="flex justify-center">
          <ChatWidget />
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-gray-500">
        © 2026 AI Chatbot SaaS
      </footer>

    </main>
  );
}