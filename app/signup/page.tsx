"use client";

import { useState } from "react";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e: any) => {
    e.preventDefault();
    alert("Signup logic will connect to Supabase here");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">

      <div className="grid md:grid-cols-2 bg-gray-900 rounded-xl overflow-hidden shadow-lg max-w-4xl w-full">

        {/* Left Side */}
        <div className="p-10 hidden md:flex flex-col justify-center bg-blue-600">

          <h2 className="text-3xl font-bold mb-6">
            AI Chatbot SaaS
          </h2>

          <p className="mb-6">
            Create AI chatbots that capture leads, answer questions,
            and automate bookings for your business.
          </p>

          <ul className="space-y-3 text-sm">
            <li>✔ Capture leads automatically</li>
            <li>✔ AI replies to customer queries</li>
            <li>✔ Automate service bookings</li>
            <li>✔ View conversation analytics</li>
          </ul>

        </div>

        {/* Right Side */}
        <div className="p-10">

          <h1 className="text-2xl font-bold mb-2">
            Create your account
          </h1>

          <p className="text-gray-400 mb-6">
            Start your free AI chatbot today.
          </p>

          <form onSubmit={handleSignup} className="space-y-4">

            <input
              type="email"
              placeholder="Email address"
              className="w-full p-3 rounded bg-gray-800 border border-gray-700"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 rounded bg-gray-800 border border-gray-700"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded font-semibold"
            >
              Create Free Account
            </button>

          </form>

          <p className="text-gray-400 text-sm mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-blue-400">
              Login
            </a>
          </p>

        </div>

      </div>

    </main>
  );
}