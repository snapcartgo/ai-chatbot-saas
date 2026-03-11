"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: any) => {
    e.preventDefault();

    // Prevent multiple clicks
    if (loading) return;

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/update-password",
    });

    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      alert("Password reset email sent!");

      // cooldown to avoid rate limit
      setTimeout(() => {
        setLoading(false);
      }, 30000); // 30 seconds
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">

      <div className="bg-gray-900 p-10 rounded-xl max-w-md w-full">

        <h1 className="text-2xl font-bold mb-6">
          Reset your password
        </h1>

        <form onSubmit={handleReset} className="space-y-4">

          <input
            type="email"
            placeholder="Enter your email"
            className="w-full p-3 rounded bg-gray-800 border border-gray-700"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

        </form>

      </div>

    </main>
  );
}